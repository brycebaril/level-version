module.exports = function (db, options) {
  return wrap(db, new Version(options))
}
module.exports.Version = Version

var wrap = require("level-onion")
var fix = require("level-fix-range")
var concat = require("terminus").concat
var gc = require("./gc")

// TODO until https://github.com/rvagg/node-levelup/issues/218 is resolved
var NotFoundError = require("levelup/lib/errors").NotFoundError
var NativeBatch = require("levelup/lib/batch")

var through = require("through2")

var u = require("./util")
var makeKey = u.makeKey
var unmakeKey = u.unmakeKey
var wrapCb = u.wrapCb
var encode = u.encode
var decode = u.decode

/**
 * @param  {Object} options  Wrapping options
 *   - gcMaxVersions [no default] When doing GC it will only keep gcMaxVersions for each key
 *   - gcMaxAge [no default] When doing GC only keep versions where (latest_version) - gcMaxAge > version
 *   - gcFreqMs [60000] How often the GC runs to apply GC rules. Only runs if a gcMax* option is set.
 *   - gcBackup [no default] A level-version instance to put gc-culled records into.
 *   - gcCallback [no default] A callback to execute when gc sweeps complete
 *   - defaultVersion [Date.now] A function to provide the default version if none is specified.
 *   - delimiter [\xff] The internal delimiter to use.
 */

function Version(options) {
  this.type = "version"
  this.unique = true
  options = options || {}
  this.options = options

  if (!options.defaultVersion) options.defaultVersion = Date.now
  if (typeof options.defaultVersion != "function")
    throw new Error("defaultVersion generator must be a function.")

  this.delimiter = (options.delimiter != null) ? options.delimiter : "\xff"
  this.defaultVersion = options.defaultVersion
}

Version.prototype.install = function (db, parent) {
  var self = this
  var sep = this.delimiter

  setTimeout(function () {
    self.gc = gc(db, self.options)
  }, self.options.gcFreqMs)

  /* -- put -- */
  db.put = function (key, value, options, cb) {
    if (!cb && typeof options == "function") {
      cb = options
      options = {}
    }
    if (options == null) options = {}

    var version = (options.version != null) ? options.version : self.defaultVersion()

    return parent.put(makeKey(sep, key, version), value, options, wrapCb(version, cb))
  }


  /* -- get -- */
  db.get = function (key, options, cb) {
    if (!cb && typeof options == "function") {
      cb = options
      options = {}
    }
    
    if (cb && options && !(options instanceof Function) && typeof options !== "object") {
      // option candy machine
      options = {version: options}
    }
    
    if (options == null) options = {}

    if (options.version == null) {
      return db.getLast(key, options, cb)
    }

    return parent.get(makeKey(sep, key, options.version), options, wrapCb(options.version, cb))
  }

  function getEnd(reverse, key, options, cb) {
    if (!cb && typeof options == "function") {
      cb = options
      options = undefined
    }
    if (!cb) throw new Error("Get with no callback?")

    function collect(records) {
      if (!records || !records.length) {
        return cb(new NotFoundError("Key not found in database [" + key + "]"))
      }
      var r = records[0]
      // TODO other options?
      if (options && options.valueEncoding == "json") r.value = JSON.parse(r.value)
      return cb(null, r.value, r.version)
    }

    db.createVersionStream(key, {limit: 1, reverse: reverse})
      .pipe(concat({objectMode: true}, collect))
  }

  db.getLast = function (key, options, cb) {
    return getEnd(false, key, options, cb)
  }

  db.getFirst = function (key, options, cb) {
    return getEnd(true, key, options, cb)
  }

  /* -- del -- */
  db.del = function (key, options, cb) {
    if (!cb && typeof options == "function") {
      cb = options
      options = {}
    }
    var version = (options.version != null) ? options.version : self.defaultVersion()
    return parent.del(makeKey(sep, key, version), options, wrapCb(version, cb))
  }

  /* -- batch -- */

  function Batch() {
    this._batch = new NativeBatch(parent)
  }
  Batch.prototype.put = function (key, value, options) {
    if (options == null) options = {}
    var version = (options.version != null) ? options.version : self.defaultVersion()
    this._batch.put(makeKey(sep, key, version), value, options)
    return this
  }
  Batch.prototype.del = function (key, options) {
    var version = (options.version != null) ? options.version : self.defaultVersion()
    this._batch.del(makeKey(sep, key, version), options)
    return this
  }
  Batch.prototype.clear = function () {
    this._batch.clear()
    return this
  }
  Batch.prototype.write = function (callback) {
    parent.once("batch", function (batch) {
      // TODO this has a potential race condition if someone is simultaneously writing batches
      // against the non-version-wrapped parent.
      db.emit("batch", batch)
    })
    this._batch.write(callback)
    return this
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

    if (options._start) options.start = options._start
    if (options._end) options.end = options._end

    if (options.maxVersion == null) options.maxVersion = u.MAX_VERSION
    if (options.minVersion == null) options.minVersion = u.MIN_VERSION

    var removeKeys = (options.keys === false) ? true : false
    options.keys = true

    var filter = through({objectMode: true}, function (record, encoding, cb) {
      if (typeof record != "object") {
        if (options.keys) record = {key: record}
        if (options.values) record = {value: record}
        // if both are true... wtf?
      }

      // split off version key & add it to record
      var kv = unmakeKey(sep, record.key)

      if (options.versionLimit) {
        if (kv.key != this.currentKey) {
          this.currentKey = kv.key
          this.currentCount = 0
        }
        if (this.currentCount++ >= options.versionLimit) return cb()
      }

      if (kv.version >= options.minVersion && kv.version <= options.maxVersion) {
        record.version = kv.version
        record.key = kv.key
        this.push(record)
      }
      cb()
    })
    parent.createReadStream(fix(options))
      .pipe(filter)

    if (removeKeys) {
      var stripKeys = through({objectMode: true}, function (record, encoding, cb) {
        record.key = undefined
        this.push(record)
        cb()
      })
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
  // TODO this may break the contract of levelup.createValueStream
  //  as this puts it in objectMode vs Buffer mode with raw values...
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

    // Ignore start/min end/max
    options.start = options.min = options.end = options.max = undefined

    options._start = (options.minVersion != null)
                  ? makeKey(sep, key, options.minVersion)
                  : key + sep + sep

    options._end = (options.maxVersion != null)
                ? makeKey(sep, key, options.maxVersion)
                : key + sep

    return db.createReadStream(options)
  }

  db.versionStream = db.createVersionStream

  /* -- createWriteStream -- */
  db.createWriteStream = function (options) {
    options = options || {}

    var transform = through({objectMode: true}, function (record, encoding, cb) {
      var version = (record.version != null) ? record.version : self.defaultVersion()

      // Important to make a copy here in case we're saving this in multiple places.
      var insert = {type: record.type, key: makeKey(sep, record.key, version), value: record.value}
      this.push(insert)
      cb()
    })

    var ws = parent.createWriteStream(options)
    transform.pipe(ws)

    return transform
  }
  db.writeStream = db.createWriteStream

  /* -- close -- */
  db.close = function (cb) {
    if (this.gc) this.gc.stop()
    return parent.close()
  }
}
