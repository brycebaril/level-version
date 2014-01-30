var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-simple", {valueEncoding: "json"})

var version = require("../")
var db = version(testdb)

var lastVersion

test("json encoding put no default version", function (t) {
  db.put("pet", {foo: "bar"})
  t.end()
})

test("value is there", function (t) {
  t.plan(2)
  db.get("pet", function (err, value, version) {
    t.deepEquals(value, {foo: "bar"})
    t.ok(version >= Date.now() - 50 && version < Date.now() + 1)
  })
})

test("correct error type when data missing", function (t) {
  db.get("does/not/exist", function (err, value, version) {
    t.ok(err)
    t.equals(err.type, "NotFoundError")
    t.equals(err.status, 404)
    t.ok(err.notFound)
    t.notOk(value)
    t.notOk(version)
    t.end()
  })
})