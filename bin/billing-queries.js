#!/usr/bin/env node

console.log('HELLO FROM BILLING-QUERIES!');

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

const BILLING_URL = process.env.BILLING_URL || 'localhost:3000';

// NB: default (test) key
// matching pubkey: '02439658e54579d120b0fd24d323e413d028704f845b8f7ab5b11e91d6cd5dbb00';
const PRIVKEY = process.env.PRIVKEY ||
    'd6b0e5ac88be1f9c3749548de7b6148f14c2ca8ccdf5295369476567e8c8d218';

const billingClient = new BillingClient(BILLING_URL, PRIVKEY);
const storage = new Storage(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/__storj-billing-development', mongoOptions);
const generateDebits = require('../lib/queries/generate-debits')(storage, billingClient);
const generateReferralCredits = require('../lib/queries/generate-referral-credits')(storage, billingClient);
const connectedPromise = new Promise((resolve, reject) => {
  storage.connection.on('connected', resolve);
  storage.connection.on('error', reject);
});

connectedPromise
    .then(function() {
      const CronJob = require('cron').CronJob;
      const job = new CronJob({
        cronTime: '0 0 0 * * *',
        onTick: function() {
          console.log('connected!');
          const now = moment().utc();
          const endTimestamp = moment.utc(
              `${now.year()}-${now.month() + 1}-${now.date()}`,
              'YYYY-MM-DD'
          ).valueOf();
          const beginTimestamp = moment.utc(endTimestamp).subtract(1, 'day').valueOf();
          console.log(`timestamp range: ${beginTimestamp}-${endTimestamp}`);

          // console.log('starting...');
          const bandwidthDebitsPromise = generateDebits
              .forBandwidth(beginTimestamp, endTimestamp, CENTS_PER_GB_BANDWIDTH)
              .then(() => console.log('... forBandwidth done!'));
          const storageDebitsPromise = generateDebits
              .forStorage(beginTimestamp, endTimestamp, CENTS_PER_GB_STORAGE)
              .then(() => console.log('... forStorage done!'));
          const referralCreditsPromise = generateReferralCredits()
              .then(() => console.log('... referral credits done!'));

          Promise.all([bandwidthDebitsPromise, storageDebitsPromise, referralCreditsPromise])
              .then(() => console.log(
                  `IMPORT COMPLETE: ${moment.utc(beginTimestamp).format('YYYY-MM-DD HH:MM:SS')} - ${moment.utc(beginTimestamp).format('YYYY-MM-DD HH:MM:SS')}`
              ));
        },
        start: false,
        timeZone: 'UTC'
      });
      job.start();
    })
    .catch(function(err) {
      console.error('ERROR: ');
      console.error(err);
      // process.exit(1);
    });
