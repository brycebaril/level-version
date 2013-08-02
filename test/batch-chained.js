var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-batch-chained")

var version = require("../")
var db = version(testdb)

var lastVersion

test("batch", function (t) {
  t.plan(3)

  db.batch()
    .put("pet", "sparky")
    .put("watch", "rolex", 5)
    .put("pet", "scratch", 334)
    .put("pet", "fluffy", 0)
    .put("watch", "calculator", 11)
    .put("watch", "casio", 14)
    .write(function (err) {
      t.notOk(err, "No error")
      db.get("pet", function (err, value, version) {
        t.notOk(err, "No error")
        lastVersion = version
        t.equals(value, "sparky", "Sparky is the latest version")
      })
    })
})

test("batch delete", function (t) {
  t.plan(2)

  db.batch()
    .del("watch", 5)
    .put("pet", "spot", 1)
    .write(function (err) {
    t.notOk(err, "no error")
      db.get("watch", 5, function (err, value, version) {
        t.ok(err, "Deleted, never owned a rolex.")
      })
    })
})

test("stream it back", function (t) {
  t.plan(7)

  var versions = []
  db.createReadStream()
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      // 11 comes last because 'watch' comes after the pets
      t.deepEqual(versions, [lastVersion, 334, 1, 0, 14, 11], "Versions came out in the correct order")
    })
})
