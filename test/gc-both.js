var test = require("tape").test

var version = require("../")

var level = require("level-test")()
var testdb = level("test-gc-maxage")

var FIVE_MIN = 300000
var TEN_MIN = 600000
var DAY = 86400000
var YEAR = 31536000000


var testStart = Date.now()

test("maxAge and maxVersions", function (t) {
  t.plan(16)

  var firstRun = true
  function checkStats(err, start, end, scanned, culled) {
    t.notOk(err, "No gc error")
    t.ok(start > testStart, "")
    if (firstRun) {
      t.equals(scanned, 8, "Scanned 8 records")
      t.equals(culled, 4, "Culled 4 records")
      firstRun = false
    }
    else {
      t.equals(scanned, 4, "Scanned 4 records")
      t.equals(culled, 0, "Culled 0 records")

      var versions = []
      db.readStream()
        .on("data", function (record) {
          t.ok(record.version != null, "record has a version")
          versions.push(record.value)
        })
        .on("end", function () {
          t.deepEqual(versions, ["sparky", "fluffy", "calculator", "fake"], "Versions came out in the correct order")
          db.close()
        })
    }
  }

  var db = version(testdb, {
    gcMaxAge: TEN_MIN,
    gcMaxVersions: 2,
    gcCallback: checkStats,
    gcFreqMs: 100
  })

  db.batch([
    {type: "put", key: "pet", value: "sparky"},
    {type: "put", key: "pet", value: "spot", version: Date.now() - DAY},
    {type: "put", key: "pet", value: "scratch", version: Date.now() - YEAR},
    {type: "put", key: "pet", value: "fluffy", version: Date.now() - FIVE_MIN},
    {type: "put", key: "watch", value: "calculator", version: Date.now()},
    {type: "put", key: "watch", value: "casio", version: Date.now() - FIVE_MIN},
    {type: "put", key: "watch", value: "rolex", version: Date.now() - FIVE_MIN + 3},
    {type: "put", key: "watch", value: "fake", version: Date.now() - FIVE_MIN + 10},
  ], function (err) {
    t.notOk(err, "No error")
    db.get("pet", function (err, value, version) {
      t.notOk(err, "No error")
      t.equals(value, "sparky", "Sparky is the latest version")
    })
  })
})