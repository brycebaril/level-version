Level Version
=============

Create versioned data inside leveldb.

[![NPM](https://nodei.co/npm/level-version.png)](https://nodei.co/npm/level-version/)


[![david-dm](https://david-dm.org/brycebaril/level-version.png)](https://david-dm.org/brycebaril/level-version/)
[![david-dm](https://david-dm.org/brycebaril/level-version/dev-status.png)](https://david-dm.org/brycebaril/level-version#info=devDependencies/)

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
db.put(key, value, function (err, version) {
  /* ... */
})

// insert a record explicitly at version 10
db.put(key, value, {version: 10}, function (err, version) {
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
db.get(key, function (err, value, version) {
  /* ... */
})

// get the first (oldest) version of the key
db.getFirst(key, function (err, value, version) {
  /* ... */
})

// get a specific version
db.get(key, {version: 10}, function (err, value, version) {
  /* ... */
})

// remove an entry
db.del(key, {version: 10}, function (err, version) {
  /* ... */
})

// a version stream for a single key between versions 100 and 1000
db.createVersionStream(key, {minVersion: 100, maxVersion: 1000}).pipe(/* ... */)

// stream all keys, but only the most recent version of each
db.createReadStream({versionLimit: 1}).pipe(/* ... */)

```

API
---

  * [`version(db [,options])`](#ctor)
  * [`.put(key, value [, options] [, cb])`](#put)
  * [`.get(key [, options] [, cb])`](#get)
  * [`.getLast(key [, options] [, cb])`](#getLast)
  * [`.getFirst(key [, options] [, cb])`](#getFirst)
  * [`.del(key [, options] [, cb])`](#del)
  * [`.createVersionStream(key [, options])`](#vs)
  * [`.createReadStream(key [, options])`](#rs)
  * [`.createValueStream(key [, options])`](#vals)
  * [`.createKeyStream(key [, options])`](#keys)
  * [`.createWriteStream(key [, options])`](#ws)
  * [Garbage Collection](#gc)

---

<a id="ctor"></a>
`var db = version(leveldb [,options])`
------------------------

Construct a new levelup object with version as a wrapper. The original `leveldb` instance will remain unchanged. The wrapped object should behave almost identically to the original, except all put/get operations are version aware.

[Garbage Collection](#gc) options can be set in order to control how many versions of each record are retained.

### Options
 * gcMaxVersions [no default] When doing GC it will only keep gcMaxVersions newest versions of each key
 * gcMaxAge [no default] When doing GC only keep versions where Date.now() - gcMaxAge > version
 * gcFreqMs [60000] How often the GC runs to apply GC rules. Only runs if a gcMax* option is set.
 * gcBackup [no default] A level-version instance to stream culled records into
 * gcCallback [no default] A callback to execute when gc sweeps complete
 * defaultVersion: [Date.now] A function to provide the default version if none is specified.
 * delimiter: [\xff] The internal delimiter to use.

<a id="put"></a>
`.put(key, value [, options] [, cb])`
-------------------------------------

Insert a record into leveldb with a version stamp.

### Callback

callback(err, version) -- version will be the version the record was saved with.

### Options

  * version: [defaultVersion()] The version stamp for the record. If not given, it will use the defaultVersion function to generate one.
  * standard levelup `put` options.

<a id="get"></a>
`.get(key [, options] [, cb])`
------------------------------

Retrieve a record from leveldb. If no version is specified, this is equivalent to [getLast](getLast).

### Callback

callback(err, value, version)

### Options

  * version: [scan for highest] The version stamp for the record. If not specified, it will find the version with the _highest_ version.
  * standard levelup `get` options.

<a id="getLast"></a>
`.getLast(key [, options] [, cb])`
----------------------------------

Retrieve the latest version of a record from leveldb. That is the version with the *highest* version number.

### Callback

callback(err, value, version)

### Options

  * standard levelup `get` options.

<a id="getFirst"></a>
`.getFirst(key [, options] [, cb])`
-----------------------------------

Retrieve the first version of a record from leveldb. That is the version with the *lowest* version number.

### Callback

callback(err, value, version)

### Options

  * standard levelup `get` options.

<a id="del"></a>
`.del(key [, options] [, cb])`
------------------------------

Remove a version of a record from leveldb. You should generally always be specifying a version with `del`

### Callback

callback(err, version) -- version will be the version of the record removed.

### Options

  * version: [defaultVersion()] The version stamp for the record. If not given, it will use the defaultVersion function to generate one. (I.e. specify a version)
  * standard levelup `del` options.

<a id="vs"></a>
`.createVersionStream(key [, options])`
---------------------------------------

Stream versions of a key from _highest_ to _lowest_ version. I.e. newest first. Results in an `objectMode` stream where records are in the format `{key: key, value: value, version: version}`

### Options

  * minVersion: [default -Math.pow(2, 53)] The lowest version to return
  * maxVersion: [default Math.pow(2, 53)] The highest version to return
  * versionLimit: [no default] How many versions to return before ending the stream
  * standard levelup readstream options __except__ start/end are __ignored__

<a id="rs"></a>
`.createReadStream(key [, options])`
------------------------------------

Stream versions of all records within `options.start` and `options.end` from _highest_ to _lowest_ version. I.e. newest first. Results in an `objectMode` stream where records are in the format `{key: key, value: value, version: version}`

### Options

  * minVersion: [default -Math.pow(2, 53)] The lowest version to return
  * maxVersion: [default Math.pow(2, 53)] The highest version to return
  * versionLimit: [no default] How many versions to return before ending the stream
  * standard levelup readstream options

<a id="vals"></a>
`.createValueStream(key [, options])`
-------------------------------------

Identical to `createReadStream` but only values & versions will be returned.

<a id="keys"></a>
`.createKeyStream(key [, options])`
-----------------------------------

Identical to `createReadStream` but only keys & versions will be returned.

<a id="ws"></a>
`.createWriteStream(key [, options])`
-------------------------------------

Creates a writable stream suitable for writing to or deleting from a versioned leveldb.

```javascript
var ws = db.createWriteStream()
ws.write({key: "cat", value: "meow", version: 12345})
ws.write({key: "dog", value: "woof"})
ws.write({type: "del", key: "fish", version: 2121})
ws.end()
```

### Options

  * standard levelup writesteram options

<a id="gc"></a>
Garbage Collection
------------------

When creating your versioned db, you can specify options related to garbage collection. If you set a `gcMaxVersions` or `gcMaxAge` it will periodically scan through your db instance and delete any versions based on the criteria you've specified.

 * gcMaxVersions [no default] When doing GC it will only keep gcMaxVersions newest versions of each key
 * gcMaxAge [no default] When doing GC only keep versions where Date.now() - gcMaxAge > version
 * gcFreqMs [60000] How often the GC runs to apply GC rules. Only runs if a gcMax* option is set.
 * gcBackup [no default] A level-version instance to stream culled records into
 * gcCallback [no default] A callback to execute when gc sweeps complete

LICENSE
=======

MIT