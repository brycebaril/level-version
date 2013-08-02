var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-keyvalstream")

var version = require("../")
var db = version(testdb)

var lastVersion

test("stuff some datas", function (t) {
  t.plan(2)

  db.put("pet", "fluffy", {version: 0})
  db.put("pet", "spot", {version: 1})
  db.put("pet", "scratch", {version: 334})
  db.put("watch", "calculator", {version: 11})
  db.put("pet", "sparky", function (err, version) {
    t.notOk(err, "no error")
    t.ok(version > Date.now() - 1000, "Default version is a recent timestamp")
    lastVersion = version
  })
})

test("keystream", function (t) {
  var versions = []
  db.createKeyStream()
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      t.ok(record.key != null, "record has a key")
      t.notOk(record.value, "no value")
      versions.push(record.version)
    })
    .on("end", function () {
      // 11 comes last because 'watch' comes after the pets
      t.deepEqual(versions, [lastVersion, 334, 1, 0, 11], "Versions came out in the correct order")
      t.end()
    })
})

test("value stream", function (t) {
  var versions = []
  db.createValueStream()
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      t.ok(record.value != null, "record has a value")
      t.notOk(record.key, "no key")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [lastVersion, 334, 1, 0, 11], "Versions came out in the correct order")
      t.end()
    })
})
