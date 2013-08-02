var test = require("tape").test

var level = require("level-test")()
var testdb = level("test-writestream")

var version = require("../")
var db = version(testdb)

var lastVersion

test("stuff some datas", function (t) {

  function checkOne() {
    db.get("pet", function (err, value, version) {
      t.notOk(err, "No error")
      lastVersion = version
      t.equals(value, "sparky", "Sparky is the latest version")
      t.end()
    })
  }

  var ws = db.createWriteStream()
  ws.write({key: "pet", value: "sparky"})
  ws.write({key: "pet", value: "scratch", version: 334})
  ws.write({key: "pet", value: "fluffy", version: 0})
  ws.write({key: "pet", value: "spot", version: 1})
  ws.write({key: "watch", value: "calculator", version: 11})
  ws.write({key: "watch", value: "casio", version: 14})
  ws.end(function () {
    // Wait for leveldb to catch up (it ends when things are still buffered?)
    setTimeout(checkOne, 50)
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
      t.deepEqual(versions, [lastVersion, 334, 1, 0, 14, 11], "Versions came out in the correct order")
    })
})
