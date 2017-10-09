#!/usr/bin/env node
const logger = require('../lib/logger');
const StorjMailer = require('storj-service-mailer');
const defaults = require('../config.js').DEFAULTS;
const mailer = new StorjMailer(defaults.mailer);
const moment = require('moment');
const program = require('commander');
const rl = require('readline');
const Storage = require('storj-service-storage-models');
const BillingClient = require('../lib/utils/billing-client');
const CENTS_PER_GB_BANDWIDTH = 5.0;
const CENTS_PER_GB_HOUR_STORAGE = 0.002054795;

program
  .version('0.0.1')
  .usage('[options]')
  .option(
    '-b, --begin [time]',
    'Begin Time in ISO Date format EX: 2017-03-27 - Default: Today'
  )
  .option(
    '-d, --days <number>',
    'Number of days to generate debits for starting at Begin Time - Default: 1',
    parseInt
  )
  .option(
    '-R, --remove',
    'Remove existing debits within the selected date range before generation (not yet implemented)'
  )
  .option(
    '-y, --yes',
    'Automatically say yes to all prompts'
  )
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(1);
}

// NB: if no `[time]` passed (e.g. `./create-debits.js -b`), `program.begin` will be `true`.
const generationBeginDate = (program.begin == true) ? moment.utc() : moment.utc(program.begin, 'YYYY-MM-DD');
const generationDays = program.days || 1;
const generationEndDate = moment.utc(generationBeginDate).add(generationDays, 'day');
const removeExistingDebits = program.remove || false;

const DOLLARS_PER_GB_HOUR_STORAGE = .00002054795;

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

function start() {
  const billingClient = new BillingClient(BILLING_URL, PRIVKEY);
  const storage = new Storage(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/bridge', mongoOptions);
  const generateDebits = require('../lib/queries/generate-debits')(storage, billingClient);
  const connectedPromise = new Promise((resolve, reject) => {
    storage.connection.on('connected', resolve);
    storage.connection.on('error', reject);
  });

  connectedPromise
    .then(countDebits(storage))
    // .then(deleteDebits)
    .then(function() {
      logger.debug('connected!');
      // const bandwidthDebitsPromises = [];
      // const storageDebitsPromises = [];

      countDebits(storage).then(function() {
        let promiseChain = Promise.resolve();

        for (let i = 1; i <= generationDays; i++) {
          promiseChain = promiseChain.then(() => {
            const beginTimestamp = generationBeginDate.valueOf();
            const endTimestamp = generationBeginDate.add(i, 'day').valueOf();
            const beginTimestampStr = `${moment.utc(beginTimestamp).format('MM-DD-YYYY HH:mm:ss')}`;
            const endTimestampStr = `${moment.utc(endTimestamp).format('MM-DD-YYYY HH:mm:ss')}`;
            const timestampRange = `${beginTimestampStr} - ${endTimestampStr}`;

            if (removeExistingDebits) {
              logger.debug("Removing debits for date range %s", timestampRange);

              storage.models.Debit.deleteMany({
                $and: [
                  { created: { $gte: new Date(beginTimestamp) } },
                  { created: { $lt: new Date(endTimestamp) } }
                ]
              }).then(function(result) {
                logger.debug('Result from delete debits was %j', result);
              }).catch(function(err) {
                logger.error('Caught an error while deleting debits: ', err);
              });
            }

            logger.debug("Starting to create debits for date range %s", timestampRange);

            const bandwidthDebitPromise = generateDebits
              .forBandwidth(beginTimestamp, endTimestamp, CENTS_PER_GB_BANDWIDTH)
              .then(() => logger.debug(`... ${timestampRange} forBandwidth done!`));
            const storageDebitPromise = generateDebits
              .forStorage(beginTimestamp, endTimestamp, CENTS_PER_GB_HOUR_STORAGE)
              .then(() => logger.debug(`... ${timestampRange} forStorage done!`));

            logger.debug(`Kicking off debit calculation for ${timestampRange}`);
            return Promise.all([bandwidthDebitPromise, storageDebitPromise])
              .then(() => logger.debug("Done with bandwidthDebitPromise and storageDebitPromise"));
          })
        }

        return promiseChain
          .then(countDebits(storage))
          .then(() => process.exit(0));
      })
    })
    .catch(function(err) {
      logger.error(err);
      process.exit(1);
    });
};

function countDebits(storage) {
  return storage.models.Debit.count()
    .then(count => logger.debug(count));
}

function confirm(question, callback) {
  var r = rl.createInterface({
    input: process.stdin,
    output: process.stdout});
  r.question(question, function(answer) {
    r.close();
    callback(answer);
  });
}

// function deleteDebits() {
//   logger.debug('DELETING DEBITS COLLECTION');
//   return storage.models.Debit.remove({});
// }

function sendInvoice (user, amount, storage, bandwidth) {
  const self = this;

  mailer.dispatch(user, 'invoice', {
    amount: amount,
    storage: storage,
    bandwidth: bandwidth
  }, function (err) {
    if (err) {
      logger.('Error sending user invoice: ', err);
    }
  });
}

// Confirm with user that date range is as expected before moving on
console.log("We will generate debits starting on %s and ending on %s", generationBeginDate, generationEndDate);
if (program.remove) {
  console.log('WARNING - This will delete all existing bandwidth and storage debits within this date range');
}

if (!program.yes) {
  confirm('Do these dates look right? [y/N] ', function(answer) {
    console.log('Answer is: ', answer);
    if (answer === 'Y' || answer === 'y') {
      start();
    } else {
      logger.info('Ok, exiting now...');
      return process.exit(0);
    }
  });
} else {
  start();
}
