var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-options")

var version = require("../")
var db = version(testdb)

var lastVersion

test("put version 0", function (t) {
  t.plan(2)

  db.put("pet", "fluffy", {version: 0, sync: true}, function (err, version) {
    t.notOk(err, "no error")
    t.equals(version, 0, "Callback includes version")
  })
})

test("put default version", function (t) {
  t.plan(1)

  db.put("pet", {hi: "there"}, {valueEncoding: "json"}, function (err, version) {
    t.notOk(err, "no error")
    lastVersion = version
  })
})

test("put default version", function (t) {
  t.plan(1)

  db.put("pet", {hi: "bye"}, {version: 20, valueEncoding: "json"}, function (err, version) {
    t.notOk(err, "no error")
  })
})

test("get version 0", function (t) {
  t.plan(3)

  db.get("pet", {version: 0}, function (err, value, version) {
    t.notOk(err, "no error")
    t.equals(value, "fluffy")
    t.equals(version, 0, "callback includes version")
  })
})

test("get", function (t) {
  t.plan(3)

  db.get("pet", {valueEncoding: "json"}, function (err, value, version) {
    t.notOk(err, "no error")
    t.deepEquals(value, {hi: "there"})
    t.equals(version, lastVersion, "callback includes version")
  })
})

test("get", function (t) {
  t.plan(3)

  db.get("pet", {version: 20, valueEncoding: "json"}, function (err, value, version) {
    t.notOk(err, "no error")
    t.deepEquals(value, {hi: "bye"})
    t.equals(version, 20, "callback includes version")
  })
})
