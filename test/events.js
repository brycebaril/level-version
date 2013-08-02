var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-events")

var version = require("../")
var db = version(testdb)

var bytewise = require("bytewise")

var version = 100
var verionString = bytewise.encode(-version).toString("hex")

test("put", function (t) {
  t.plan(2)

  // TODO right now the library doesn't make any attempt to deconstruct keys and change emits
  db.once("put", function (key, value) {
    t.equals(key, "foo" + "\xff" + verionString, "Key matches")
    t.equals(value, "bar")
  })

  db.put("foo", "bar", {version: version})
})

// TODO is this wanted?
test("child put forwarded to parents", function (t) {
  t.plan(2)

  testdb.once("put", function (key, value) {
    t.equals(key, "zip" + "\xff" + verionString, "Key matches")
    t.equals(value, "zap")
  })

  db.put("zip", "zap", {version: version})
})

// TODO is this wanted?
test("parent put forwarded to child listener", function (t) {
  t.plan(2)

  db.once("put", function (key, value) {
    t.equals(key, "cat", "Key matches")
    t.equals(value, "meow")
  })

  testdb.put("cat", "meow", {version: version})
})
