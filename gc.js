module.exports = startGc

var gc = require("level-gc")
var looseInterval = require("loose-interval")

/**
 * Start a gc task if options dictate it. GC task will kick off
 * occasionally to reap expired versions of records.
 * @param  {Version} db      level-version instance
 * @param  {Object} options GC options
 *  - gcMaxVersions [no default] When doing GC it will only keep gcMaxVersions newest versions of each key
 *  - gcMaxAge [no default] When doing GC only keep versions where Date.now() - gcMaxAge > version
 *  - gcFreqMs [60000] How often the GC runs to apply GC rules. Only runs if a gcMax* option is set.
 *  - gcBackup [no default] A level-version instance to stream culled records into
 *  - gcCallback [no default] A callback to execute when gc sweeps complete
 * @return {LooseInterval}         A http://npm.im/loose-interval object controlling the repeated gc task.
 */
function startGc(db, options) {
  this.options = options || {}

  var freqMs = options.gcFreqMs || 60000

  var maxVersions = options.gcMaxVersions
  var maxAge = options.gcMaxAge
  var backup = options.gcBackup
  var callback = options.gcCallback

  if (maxAge || maxVersions) {
    maxAge = maxAge || Math.pow(2, 53)
    maxVersion = maxVersions || Math.pow(2, 53)

    function filter(record) {
      if (record.version != null) {
        if (Date.now() - record.version > maxAge) return true
      }
      if (record.key != this.currentKey) {
        this.currentKey = record.key
        this.currentCount = 0
      }
      return this.currentCount++ >= maxVersions
    }

    this.scanner = gc(db, filter, backup)
    return looseInterval(scanner.run.bind(scanner), freqMs, callback)
  }
}