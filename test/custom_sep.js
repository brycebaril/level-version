var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-specified")

var version = require("../")

var delimiter = "\xaa"
var db = version(testdb, {delimiter: delimiter})

var bytewise = require("bytewise")

function encode(version) {
  return bytewise.encode(version).toString("hex")
}

test("put version 0", function (t) {
  t.plan(2)

  db.put("pet", "fluffy", 0, function (err, version) {
    t.notOk(err, "no error")
    t.equals(version, 0, "Callback includes version")
  })
})

test("put version 1", function (t) {
  t.plan(2)

  db.put("pet", "spot", 1, function (err, version) {
    t.notOk(err, "no error")
    t.equals(version, 1, "Callback includes version")
  })
})

test("get version 0", function (t) {
  t.plan(3)

  db.get("pet", 0, function (err, value, version) {
    t.notOk(err, "no error")
    t.equals(value, "fluffy")
    t.equals(version, 0, "callback includes version")
  })
})

test("get version 1", function (t) {
  t.plan(3)

  db.get("pet", 1, function (err, value, version) {
    t.notOk(err, "no error")
    t.equals(value, "spot")
    t.equals(version, 1, "callback includes version")
  })
})

test("bypass wrapper", function (t) {
  t.plan(1)

  testdb.get("pet", function (err, value) {
    t.ok(err, "error because not found")
  })
})

test("bypass wrapper version 0", function (t) {
  t.plan(2)

  testdb.get("pet" + delimiter + encode(0), function (err, value) {
    t.notOk(err, "no error")
    t.equals(value, "fluffy", "got value bypassing wrapper")
  })
})

test("delete version 0", function (t) {
  t.plan(2)

  db.del("pet", 0, function (err, version) {
    t.notOk(err, "no error")
    t.equals(version, 0, "we get the version back")
  })
})

test("version 0 gone", function (t) {
  t.plan(1)

  db.get("pet", 0, function (err, value, version) {
    t.ok(err, "version 0 no longer exists")
  })
})
