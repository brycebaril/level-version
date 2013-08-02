var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-batch")

var version = require("../")
var db = version(testdb)

var lastVersion

test("batch", function (t) {
  t.plan(3)

  db.batch([
    {type: "put", key: "pet", value: "sparky"},
    {type: "put", key: "watch", value: "rolex", version: 5},
    {type: "put", key: "pet", value: "scratch", version: 334},
    {type: "put", key: "pet", value: "fluffy", version: 0},
    {type: "put", key: "watch", value: "calculator", version: 11},
    {type: "put", key: "watch", value: "casio", version: 14},
  ], function (err) {
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

  db.batch([
    {type: "del", key: "watch", version: 5},
    {type: "put", key: "pet", value: "spot", version: 1},
  ], function (err) {
    t.notOk(err, "no error")
    db.get("watch", {version: 5}, function (err, value, version) {
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
