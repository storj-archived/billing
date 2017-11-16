#!/usr/bin/env node
const logger = require('../lib/logger');

logger.debug('HELLO FROM BILLING-QUERIES!');

const moment = require('moment');
const Storage = require('storj-service-storage-models');
const BillingClient = require('../lib/utils/billing-client');
const CENTS_PER_GB_BANDWIDTH = 5.0;
const CENTS_PER_GB_HOUR_STORAGE = 0.002054795;

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
        cronTime: '0 0 0 * * *',// on the first of the month
        onTick: function() {
          logger.debug('connected!');
          const now = moment().utc();
          const endTimestamp = moment.utc(
              `${now.year()}-${now.month() + 1}-${now.date()}`,
              'YYYY-MM-DD'
          ).valueOf();
          const beginTimestamp = moment.utc(endTimestamp).subtract(1, 'day').valueOf();
          logger.debug(`timestamp range: ${beginTimestamp}-${endTimestamp}`);
          // go get credits and debits

          // sum together

          // take difference and send in invoice

          const bandwidthDebitsPromise = generateDebits
              .forBandwidth(beginTimestamp, endTimestamp, CENTS_PER_GB_BANDWIDTH)
              .then(() => logger.debug('... forBandwidth done!'));
          const storageDebitsPromise = generateDebits
              .forStorage(beginTimestamp, endTimestamp, CENTS_PER_GB_HOUR_STORAGE)
              .then(() => logger.debug('... forStorage done!'));
          const referralCreditsPromise = generateReferralCredits()
              .then(() => logger.debug('... referral credits done!'));

          Promise.all([bandwidthDebitsPromise, storageDebitsPromise, referralCreditsPromise])
              .then(() => logger.debug(
                  `IMPORT COMPLETE: ${moment.utc(beginTimestamp).format('YYYY-MM-DD HH:MM:SS')} - ${moment.utc(beginTimestamp).format('YYYY-MM-DD HH:MM:SS')}`
              ))
            .catch((err) => {
              logger.error(err);
            });
        },
        start: false,
        timeZone: 'UTC'
      });
      job.start();
    })
    .catch(function(err) {
      logger.error('ERROR: ');
      logger.error(err);
      // process.exit(1);
    });
