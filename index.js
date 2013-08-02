module.exports = function (db, options) {
  return wrap(db, new Version(options))
}
module.exports.Version = Version

var wrap = require("level-onion")
var fix = require("level-fix-range")
var concat = require("concat-stream")

var VersionFilter = require("./streams").VersionFilter
var StripKeys = require("./streams").StripKeys
var VersionTransform = require("./streams").VersionTransform

var u = require("./util")
var makeKey = u.makeKey
var unmakeKey = u.unmakeKey
var wrapCb = u.wrapCb
var encode = u.encode
var decode = u.decode

/**
 * @param  {Object} options  Wrapping options
 *                           - gcMaxVersions [no default] When doing GC it will only keep gcMaxVersions for each key
 *                           - gcMaxAge [no default] When doing GC only keep versions where (most_recent_timestamp) - gcMaxAge > version
 *                           - gcFreqMs [60000] How often the GC runs to apply GC rules.
 *                           - defaultVersion [Date.now] A function to provide the default version if none is specified.
 *                           - delimiter [\xff] The internal delimiter to use.
 */

function Version(options) {
  this.type = "version"
  this.unique = true
  options = options || {}

  // TODO GC stuffs.
  var gcOptions = {}
  if (options.gcMaxVersions) gcOptions.gcMaxVersions = +options.gcMaxVersions
  if (options.gcMaxAge) gcOptions.gcMaxAge = +options.gcMaxAge
  if (options.gcFreqMs) gcOptions.gcFreqMs = +options.gcFreqMs

  if (!options.defaultVersion) options.defaultVersion = Date.now
  if (typeof options.defaultVersion != "function") throw new Error("defaultVersion generator must be a function.")

  this.delimiter = (options.delimiter != null) ? options.delimiter : "\xff"
  this.defaultVersion = options.defaultVersion
}

Version.prototype.install = function (db, parent) {

  var self = this
  var sep = this.delimiter
  /* -- put -- */
  db.put = function (key, value, version, options, cb) {
    // put(key, value [,version] [,options] [,cb])

    // (k, v, cb)
    if (!cb && typeof version == "function") {
      cb = version
      version = undefined
    }
    // (k, v, o[, cb])
    if (!options && typeof version == "object") {
      options = version
      version = undefined
    }

    // (k, v[, o] [,cb])
    // (k, v, vr [,o] [,cb]
    if (version === undefined) version = self.defaultVersion()

    // parent is (expected to be) put(key, value [,options] [,cb])
    if (!cb && typeof options == "function") {
      cb = options
      options = undefined
    }
    return parent.put(makeKey(sep, key, version), value, options, wrapCb(version, cb))
  }


  /* -- get -- */
  db.get = function (key, version, options, cb) {
    // get(key [,version] [,options] [,cb])

    // (k, cb)
    if (!cb && typeof version == "function") {
      cb = version
      version = undefined
    }
    // (k, o [,cb])
    if (!options && typeof version == "object") {
      options = version
      version = undefined
    }

    if (!cb && typeof options == "function") {
      cb = options
      options = undefined
    }

    if (version === undefined) {
      return db.getLast(key, options, cb)
    }

    return parent.get(makeKey(sep, key, version), options, wrapCb(version, cb))
  }

  function getEnd(reverse, key, options, cb) {
    // TODO options???

    if (!cb && typeof options == "function") {
      cb = options
      options = undefined
    }
    if (!cb) throw new Error("Get with no callback?")

    function collect(records) {
      if (!records || !records.length) return cb(new Error("Did not find a record %s", key))
      var r = records[0]
      return cb(null, r.value, r.version)
    }

    db.createVersionStream(key, {limit: 1, reverse: reverse})
      .pipe(concat(collect))
  }

  db.getLast = function (key, options, cb) {
    return getEnd(false, key, options, cb)
  }

  db.getFirst = function (key, options, cb) {
    return getEnd(true, key, options, cb)
  }

  /* -- del -- */
  db.del = function (key, version, options, cb) {
    if (!cb && typeof options == "function") {
      cb = options
      options = undefined
    }
    return parent.del(makeKey(sep, key, version), options, wrapCb(version, cb))
  }

  /* -- batch -- */

  // TODO This is incomplete as it doesn't allow the per-command
  // options override that you get with chained batch syntax.
  function Batch() {
    this.ops = []
  }
  Batch.prototype.put = function (key, value, version, options) {
    // TODO ignoring options...
    this.ops.push({type: "put", key: key, value: value, version: version})
    return this
  }
  Batch.prototype.del = function (key, version, options) {
    // TODO ignoring options...
    this.ops.push({type: "del", key: key, version: version})
    return this
  }
  Batch.prototype.clear = function () {
    this.ops = []
    return this
  }
  Batch.prototype.write = function (cb) {
    db.batch(this.ops, cb)
  }

  db.batch = function (arr, options, cb) {
    if (!arguments.length) return new Batch()
    var transformed = arr.map(function (e) {
      var version = (e.version != null) ? e.version : self.defaultVersion()
      e.key = makeKey(sep, e.key, version)
      return e
    })
    parent.batch(transformed, options, cb)
  }

  /* -- STREAMS -- */

  /* -- createReadStream -- */
  db.createReadStream = function (options) {
    // additional options:
    //   minVersion -- Only include versions >= minVersion
    //   maxVersion -- Only include version <= maxVersion
    //   versionLimit -- Only return versionLimit records per key
    options = options || {}
    if (options.max != null) options.max = options.max + sep + sep
    if (options.end != null) options.end = options.end + sep + sep

    var removeKeys = ! options.keys
    options.keys = true
    options.delimiter = sep

    var filter = new VersionFilter(options)
    parent.createReadStream(fix(options))
      .pipe(filter)

    if (removeKeys) {
      var stripKeys = new StripKeys()
      filter.pipe(stripKeys)
      return stripKeys
    }

    return filter
  }

  db.readStream = db.createReadStream

  /* -- createKeyStream -- */
  db.createKeyStream = function (options) {
    options = options || {}
    options.keys = true
    options.values = false

    return db.createReadStream(options)
  }

  db.keyStream = db.createKeyStream

  /* -- createValueStream -- */
  db.createValueStream = function (options) {
    options = options || {}
    options.keys = false
    options.values = true

    return db.createReadStream(options)
  }

  db.valueStream = db.createValueStream

  /* -- createVersionStream -- */
  db.createVersionStream = function (key, options) {
    if (key == null) throw new Error("Key required for createVersionStream")
    options = options || {}
    options.delimiter = sep

    var filter = new VersionFilter(options)

    // Ignore start/min end/max
    options.start = options.min = options.end = options.max = undefined

    options.start = (options.minVersion != null)
                  ? makeKey(sep, key, options.minVersion)
                  : key + sep + sep

    options.end = (options.maxVersion != null)
                ? makeKey(sep, key, options.maxVersion)
                : key + sep

    parent.createReadStream(fix(options))
      .pipe(filter)

    return filter
  }

  db.versionStream = db.createVersionStream

  /* -- createWriteStream -- */
  db.createWriteStream = function (options) {
    options = options || {}
    options.delimiter = sep
    var transform = new VersionTransform(self.defaultVersion, options)

    var ws = parent.createWriteStream(options)
    transform.pipe(ws)

    return transform
  }
  db.writeStream = db.createWriteStream
}
