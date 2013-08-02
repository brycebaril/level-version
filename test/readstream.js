var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-readstream")

var version = require("../")
var db = version(testdb)

var lastVersion

test("stuff some datas", function (t) {
  t.plan(2)

  db.put("pet", "scratch", {version: 334})
  db.put("pet", "fluffy", {version: -1})
  db.put("pet", "spot", {version: 1})
  db.put("watch", "calculator", {version: 11})
  db.put("watch", "casio", {version: 14})
  db.put("pet", "sparky", function (err, version) {
    t.notOk(err, "no error")
    t.ok(version > Date.now() - 1000, "Default version is a recent timestamp")
    lastVersion = version
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
      t.deepEqual(versions, [lastVersion, 334, 1, -1, 14, 11], "Versions came out in the correct order")
    })
})

test("stream versionLimit", function (t) {
  t.plan(3)

  var versions = []
  db.createReadStream({versionLimit: 1})
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      // 11 comes last because 'watch' comes after the pets
      t.deepEqual(versions, [lastVersion, 14], "Versions came out in the correct order")
    })
})

test("stream ranged", function (t) {
  t.plan(3)

  var versions = []
  db.createReadStream({minVersion: 22})
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [lastVersion, 334], "Versions came out in the correct order")
    })
})

test("stream ranged reverse", function (t) {
  t.plan(4)

  var versions = []
  db.createReadStream({minVersion: 1, maxVersion: 100, reverse: true})
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [11, 14, 1], "Versions came out in the correct order")
    })
})

test("stream ranged start/end", function (t) {
  t.plan(7)

  var versions = []
  db.createReadStream({minVersion: 1, maxVersion: 500, start: "pet", end: "pet"})
    .on("data", function (record) {
      t.ok(record.key, "Record has a key")
      t.ok(record.value, "Record has a value")
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [334, 1], "Versions came out in the correct order")
    })
})

test("stream ranged start/end reverse", function (t) {
  t.plan(7)

  var versions = []
  db.createReadStream({minVersion: 1, maxVersion: 500, start: "pet", end: "pet", reverse: true})
    .on("data", function (record) {
      t.ok(record.key, "Record has a key")
      t.ok(record.value, "Record has a value")
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [1, 334], "Versions came out in the correct order")
    })
})

test("readStream alias", function (t) {
  t.plan(10)

  var versions = []
  db.readStream({limit: 3})
    .on("data", function (record) {
      t.ok(record.key, "Record has a key")
      t.ok(record.value, "Record has a value")
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [lastVersion, 334, 1], "Versions came out in the correct order")
    })
})
