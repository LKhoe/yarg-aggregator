/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('yarg_db');

// Search for documents in the current collection.
db.getCollection('music').deleteMany({});
db.getCollection('providerfetchsessions').deleteMany({});
db.getCollection('providerstats').deleteMany({});
db.getCollection('users').deleteMany({});

