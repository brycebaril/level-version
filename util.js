module.exports.makeKey = makeKey
module.exports.unmakeKey = unmakeKey
module.exports.wrapCb = wrapCb
module.exports.encode = encode
module.exports.decode = decode

module.exports.MAX_VERSION = Math.pow(2, 53)
module.exports.MIN_VERSION = -Math.pow(2, 53)

// TODO currently versions locked to numbers...

// Using "hex" to avoid binary encoding for browsers...
var bytewise = require("bytewise/hex")

function makeKey(delimiter, key, version) {
  return [key, encode(version)].join(delimiter)
}

function unmakeKey(delimiter, key) {
  if (key == null) return {key: key}
  var parts = key.split(delimiter)
  // If this happens, who knows what's going on.
  if (parts.length <= 1) return {key: key}

  var version = decode(parts.pop())

  return {key: parts.join(delimiter), version: +version}
}

function wrapCb(version, cb) {
  if (!cb) return

  return function () {
    var args = [].slice.call(arguments)
    if (args.length == 0) args.push(null)
    args.push(version)
    return cb.apply(null, args)
  }
}

// Returns versions are stored in reverse order (-version) because the most common stream is new->old
// TODO -- make this optional, timestream does *not* want it.

function encode(version) {
  return bytewise.encode(-version)
}

function decode(version) {
  return -bytewise.decode(version)
}