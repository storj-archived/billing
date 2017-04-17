#!/usr/bin/env node

console.log('HELLO FROM TEST');

const moment = require('moment');
const Storage = require('storj-service-storage-models');
const BillingClient = require('../lib/utils/billing-client');
const CENTS_PER_GB_BANDWIDTH = 5;
const CENTS_PER_GB_STORAGE = .002054795;

const MONGO_USERNAME = process.env.MONGO_USERNAME && process.env.MONGO_USERNAME.match(/\S+/)[0];
const MONGO_PASSWORD = process.env.MONGO_PASSWORD && process.env.MONGO_PASSWORD.match(/\S+/)[0];
const MONGOS = JSON.parse(process.env.MONGOS || 'false');
const REPLSET = JSON.parse(process.env.REPLSET || 'false');
const MONGO_SSL = JSON.parse(process.env.MONGO_SSL || 'false');
const mongoOptions = {
  user: MONGO_USERNAME,
  pass: MONGO_PASSWORD,
  mongos: MONGOS,
  replset: REPLSET,
  ssl: MONGO_SSL
};

const BILLING_URL = process.env.BILLING_URL || 'http://localhost:3000';

// NB: default (test) key
// matching pubkey: '02439658e54579d120b0fd24d323e413d028704f845b8f7ab5b11e91d6cd5dbb00';
const PRIVKEY = process.env.PRIVKEY ||
  'd6b0e5ac88be1f9c3749548de7b6148f14c2ca8ccdf5295369476567e8c8d218';

const billingClient = new BillingClient(BILLING_URL, PRIVKEY);
const storage = new Storage(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/bridge', mongoOptions);
const generateDebits = require('../lib/queries/generate-debits')(storage, billingClient);
const connectedPromise = new Promise((resolve, reject) => {
  storage.connection.on('connected', resolve);
  storage.connection.on('error', reject);
});

module.exports = storage;

connectedPromise
  .then(countDebits)
  //.then(deleteDebits)
  .then(function() {
    console.log('connected!');

    countDebits().then(function() {
      let promiseChain = Promise.resolve();

      for (let i = 0; i < 1; i++) {
        promiseChain = promiseChain.then(() => {
          const endTimestamp = moment.utc().subtract(1, 'day').add(i, 'day').valueOf();
          const beginTimestamp = moment.utc(endTimestamp).subtract(1, 'day').valueOf();
          const timestampRange = `timestamp range: ${moment.utc(beginTimestamp)
            .format('MM-DD-YYYY')}-${moment.utc(endTimestamp)
            .format('MM-DD-YYYY')}`;
          console.log(timestampRange);

          console.log('starting...');
          const bandwidthDebitPromise = generateDebits
            .forBandwidth(beginTimestamp, endTimestamp, CENTS_PER_GB_BANDWIDTH)
            .then(() => console.log(`... ${timestampRange} forBandwidth done!`));
          const storageDebitPromise = generateDebits
            .forStorage(beginTimestamp, endTimestamp, CENTS_PER_GB_STORAGE)
            .then(() => console.log(`... ${timestampRange} forStorage done!`));

          console.log(`Kicking off debit calculation for ${timestampRange}`);
          return Promise.all([bandwidthDebitPromise, storageDebitPromise])
            .then(() => console.log("Done with bandwidthDebitPromise and storageDebitPromise"));
        })
      }

      promiseChain
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
