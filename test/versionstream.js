var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-versionstream")

var version = require("../")
var db = version(testdb)

var lastVersion

test("stuff some datas", function (t) {
  t.plan(2)

  db.put("pet", "fluffy", {version: 0})
  db.put("pet", "spot", {version: 1})
  db.put("pet", "scratch", {version: 334})
  db.put("watch", "calculator", {version: 11})
  db.put("watch", "casio", {version: 14})
  db.put("pet", "sparky", function (err, version) {
    t.notOk(err, "no error")
    t.ok(version > Date.now() - 1000, "Default version is a recent timestamp")
    lastVersion = version
  })
})

test("versionstream pets", function (t) {
  t.plan(5)

  var versions = []
  db.createVersionStream("pet")
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [lastVersion, 334, 1, 0], "Versions came out in the correct order")
    })
})

test("versionstream pets version no min", function (t) {
  t.plan(2)

  var versions = []
  db.createVersionStream("pet", {maxVersion: 500, limit: 1})
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [334], "Versions came out in the correct order")
    })
})

test("versionstream pets version reverse no min", function (t) {
  t.plan(2)

  var versions = []
  db.createVersionStream("pet", {maxVersion: 500, limit: 1, reverse: true})
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [0], "Versions came out in the correct order")
    })
})

test("versionstream pets version range no max", function (t) {
  t.plan(2)

  var versions = []
  db.createVersionStream("pet", {minVersion: 10, limit: 1})
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [lastVersion], "Versions came out in the correct order")
    })
})

test("versionstream pets version range", function (t) {
  t.plan(2)

  var versions = []
  db.createVersionStream("pet", {minVersion: 10, maxVersion: 500, limit: 1})
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [334], "Versions came out in the correct order")
    })
})

test("versionstream watches", function (t) {
  t.plan(3)

  var versions = []
  db.createVersionStream("watch")
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [14, 11], "Versions came out in the correct order")
    })
})

test("alias", function (t) {
  var versions = []
  db.versionStream("pet")
    .on("data", function (record) {
      t.ok(record.version != null, "record has a version")
      versions.push(record.version)
    })
    .on("end", function () {
      t.deepEqual(versions, [lastVersion, 334, 1, 0], "Versions came out in the correct order")
      t.end()
    })
})
