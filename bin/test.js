#!/usr/bin/env node

console.log('HELLO FROM TEST');

const moment = require('moment');
const Storage = require('storj-service-storage-models');
const CENTS_PER_GB_BANDWIDTH = 5;
const CENTS_PER_GB_STORAGE = .002054795;

const MONGO_USERNAME = process.env.MONGO_USERNAME.match(/\S+/)[0];
const MONGO_PASSWORD = process.env.MONGO_PASSWORD.match(/\S+/)[0];
const MONGOS = JSON.parse(process.env.MONGOS || '{}');
const MONGO_SSL = JSON.parse(process.env.MONGO_SSL || 'false');
const mongoOptions = {
  user: MONGO_USERNAME,
  pass: MONGO_PASSWORD,
  mongos: MONGOS,
  ssl: MONGO_SSL
};

const storage = new Storage(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/__storj-billing-development', mongoOptions);
module.exports = storage;

const generateDebits = require('../lib/queries/generate-debits')(storage);
const connectedPromise = new Promise((resolve, reject) => {
  storage.connection.on('connected', resolve);
  storage.connection.on('error', reject);
});

connectedPromise
    .then(countDebits)
    .then(deleteDebits)
    .then(function() {
      console.log('connected!');
      const now = moment().utc();
      const bandwidthDebitsPromises = [];
      const storageDebitsPromises = [];

      countDebits().then(function() {
        for (let i = 0; i < 30; i++) {
          const endTimestamp = moment.utc().subtract(1, 'month').add(i, 'day').valueOf();
          const beginTimestamp = moment.utc(endTimestamp).subtract(1, 'day').valueOf();
          const timestampRange = `timestamp range: ${moment.utc(beginTimestamp)
              .format('MM-DD-YYYY')}-${moment.utc(endTimestamp)
              .format('MM-DD-YYYY')}`;
          console.log(timestampRange);

          console.log('starting...');
          bandwidthDebitsPromises.push(generateDebits
              .forBandwidth(beginTimestamp, endTimestamp, CENTS_PER_GB_BANDWIDTH)
              .then(() => console.log(`... ${timestampRange} forBandwidth done!`)));
          storageDebitsPromises.push(generateDebits
              .forStorage(beginTimestamp, endTimestamp, CENTS_PER_GB_STORAGE)
              .then(() => console.log(`... ${timestampRange} forStorage done!`)));
        }
        Promise.all(bandwidthDebitsPromises.concat(storageDebitsPromises))
            .then(countDebits)
            .then(() => process.exit(0));
      })
    })
    .catch(function(err) {
      // throw new Error(err);
      countDebits(() => {
        console.error(err);
        process.exit(1);
      })
    });

function countDebits() {
  return storage.models.Debit.count()
      .then(count => console.log(count));
}

function deleteDebits() {
  console.log('DELETING DEBITS COLLECTION');
  return storage.models.Debit.remove({});
}
