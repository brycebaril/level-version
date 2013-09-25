var test = require("tape").test

var version = require("../")

var level = require("level-test")()
var testdb = level("test-gc-maxvers")
var lts = version(level("test-gc-maxvers-lts"))

var FIVE_MIN = 300000
var TEN_MIN = 600000
var DAY = 86400000
var YEAR = 31536000000


var testStart = Date.now()

test("maxVersions", function (t) {
  t.plan(14)

  var firstRun = true
  function checkStats(err, start, end, scanned, culled) {
    t.notOk(err, "No gc error")
    t.ok(start > testStart, "")
    if (firstRun) {
      t.equals(scanned, 6, "Scanned 6 records")
      t.equals(culled, 4, "Culled 4 records")
      firstRun = false
    }
    else {
      t.equals(scanned, 2, "Scanned 2 records")
      t.equals(culled, 0, "Culled 0 records")

      var versions = []
      db.createReadStream()
        .on("data", function (record) {
          t.ok(record.version != null, "record has a version")
          versions.push(record.value)
        })
        .on("end", function () {
          t.deepEqual(versions, ["sparky", "casio"], "Versions came out in the correct order")
          db.close()
        })
    }
  }

  var db = version(testdb, {gcMaxVersions: 1, gcCallback: checkStats, gcFreqMs: 100, gcBackup: lts})

  db.batch([
    {type: "put", key: "pet", value: "sparky"},
    {type: "put", key: "pet", value: "spot", version: Date.now() - DAY},
    {type: "put", key: "pet", value: "scratch", version: Date.now() - YEAR},
    {type: "put", key: "pet", value: "fluffy", version: Date.now() - FIVE_MIN},
    {type: "put", key: "watch", value: "calculator", version: 11},
    {type: "put", key: "watch", value: "casio", version: 14},
  ], function (err) {
    t.notOk(err, "No error")
    db.get("pet", function (err, value, version) {
      t.notOk(err, "No error")
      t.equals(value, "sparky", "Sparky is the latest version")
    })
  })
})

test("check lts", function (t) {
  t.plan(5)

  var versions = []
  lts.createReadStream()
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.value)
    })
    .on("end", function () {
      t.deepEqual(versions, ["fluffy", "spot", "scratch", "calculator"], "Versions came out in the correct order")
    })
})