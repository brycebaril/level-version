module.exports.VersionFilter = VersionFilter
module.exports.StripKeys = StripKeys
module.exports.VersionTransform = VersionTransform

var Transform = require("stream").Transform
if (!Transform) Transform = require("readable-stream/transform")
var util = require("util")

var extend = require("xtend")

var makeKey = require("./util").makeKey
var unmakeKey = require("./util").unmakeKey
var MAX_VERSION = require("./util").MAX_VERSION
var MIN_VERSION = require("./util").MIN_VERSION

function VersionFilter(filterOptions, options) {
  options = options || {}
  // force objectMode
  options.objectMode = true
  Transform.call(this, options)
  filterOptions = extend({keys: true, values: true}, filterOptions)
  // TODO Make this work with non-numeric versions
  this.min = (filterOptions.minVersion != null) ? +filterOptions.minVersion : MIN_VERSION
  this.max = (filterOptions.maxVersion != null) ? +filterOptions.maxVersion : MAX_VERSION
  this.limit = (filterOptions.versionLimit != null) ? +filterOptions.versionLimit : undefined
  this.keys = filterOptions.keys
  this.values = filterOptions.values
  this.currentKey = ""
  this.currentCount = 0
  this.delimiter = filterOptions.delimiter
}
util.inherits(VersionFilter, Transform)

VersionFilter.prototype._transform = function (record, encoding, cb) {
  if (typeof record != "object") {
    if (this.keys) record = {key: record}
    if (this.values) record = {value: record}
    // if both are true... wtf?
  }

  // split off version key & add it to record
  var keyVersion = unmakeKey(this.delimiter, record.key)

  if (this.limit) {
    if (keyVersion.key != this.currentKey) {
      this.currentKey = keyVersion.key
      this.currentCount = 0
    }
    if (this.currentCount++ >= this.limit) return cb()
  }

  if (keyVersion.version >= this.min && keyVersion.version <= this.max) {
    record.version = +keyVersion.version
    record.key = keyVersion.key
    this.push(record)
  }
  cb()
}

function StripKeys(options) {
  options = options || {}
  options.objectMode = true
  Transform.call(this, options)
}
util.inherits(StripKeys, Transform)

StripKeys.prototype._transform = function (record, encoding, cb) {
  record.key = undefined
  this.push(record)
  cb()
}

function VersionTransform(versionGenerator, options) {
  options = options || {}
  // override forcing object mode
  options.objectMode = true
  Transform.call(this, options)
  this.versionGenerator = versionGenerator
  this.delimiter = options.delimiter
}
util.inherits(VersionTransform, Transform)

VersionTransform.prototype._transform = function (record, encoding, cb) {
  var version = (record.version != null) ? record.version : this.versionGenerator()
  record.key = makeKey(this.delimiter, record.key, version)
  this.push(record)
  cb()
}
