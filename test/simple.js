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