var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-init")

var version

test("load", function (t) {
  t.plan(1)

  version = require("../")
  t.ok(version, "Loaded level-versions")
})

test("wrap default", function (t) {
  t.plan(1)

  var db = version(testdb)
  t.deepEqual(db.layers, ["version"], "Version hooks installed")
})
