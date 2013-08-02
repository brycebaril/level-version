Level Version
=============

Create versioned data inside leveldb.

[![NPM](https://nodei.co/npm/level-version.png)](https://nodei.co/npm/level-version/)

`level-version` wraps levelup in a similar way to `level-sublevel` works, where instead of assigning your keys a prefix, it postfixes your keys with a version stamp.

By default the versions are millisecond timestamps, but they can be anything you want. Either specify them manually or provide a default version generating function. For some of the features to work correctly the versions should lexically sort. In the initial version some features only support numeric versions, but with some modifications it should all be able to support non-numeric lexically ordered values.

It also includes GC options that let you control how many or how old of versions you want to keep around.

Works with `level-sublevel` instances.

Example
-------

```javascript

var LevelUp = require("levelup")
var version = require("level-version")

var original = LevelUp("./my-db")

// writes to db will be versioned, writes to original will not
var db = version(original)

// insert a record with the default version
db.put(key, value, function () {
  /* ... */
})

// insert a record explicitly at version 10
db.put(key, value, {version: 10}, function () {
  /* ... */
})

// batch insert a few records
db.batch([
  {type: "put", key: "cat", value: "sleep"}, // default version
  {type: "put", key: "cat", value: "play", version: 122},
  /* ... */
], function () {
  /* ... */
})

// get the most recent version of the key (synonymous with .getLast(k, cb))
db.get(key, function (err, value) {
  /* ... */
})

// get the first (oldest) version of the key
db.getFirst(key, function (err, value) {
  /* ... */
})

// get a specific version
db.get(key, {version: 10}, function (err, value) {
  /* ... */
})

// remove an entry
db.del(key, {version: 10}, function () {
  /* ... */
})

// a version stream
db.createVersionStream(key, streamOpts).pipe(/* ... */)

```

API
---

  * Versions()
  * put()
  * get()
  * getFirst()
  * getLast()
  * del()
  * createVersionStream()
  * createReadStream()
  * createWriteStream()
  * Garbage Collection
  * etc.
