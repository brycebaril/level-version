var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-getfirstlast")

var version = require("../")
var db = version(testdb, {defaultVersion: function () { return 99999 }})

test("put version 12345", function (t) {
  t.plan(2)

  db.put("pet", "spike", {version: 12345}, function (err, version) {
    t.notOk(err, "no error")
    t.equals(version, 12345, "Callback includes version")
  })
})

test("put version 0", function (t) {
  t.plan(2)

  db.put("pet", "fluffy", {version: 0}, function (err, version) {
    t.notOk(err, "no error")
    t.equals(version, 0, "Callback includes version")
  })
})

test("getFirst", function (t) {
  t.plan(3)

  db.getFirst("pet", function (err, value, version) {
    t.notOk(err, "no error")
    t.equals(value, "fluffy", "fluffy was first")
    t.equals(version, 0, "fluffy is version 0")
  })
})

test("getLast", function (t) {
  t.plan(3)

  db.getLast("pet", function (err, value, version) {
    t.notOk(err, "no error")
    t.equals(value, "spike", "spike is last")
    t.equals(version, 12345, "spike is version 12345")
  })
})

test("put default version", function (t) {
  t.plan(2)

  db.put("pet", "curly", function (err, version) {
    t.notOk(err, "no error")
    t.equals(version, 99999, "used provided default version generator")
  })
})

test("getLast alias", function (t) {
  t.plan(3)

  db.get("pet", function (err, value, version) {
    t.notOk(err, "no error")
    t.equals(value, "curly", "curly is now last")
    t.equals(version, 99999, "curly's version")
  })
})
