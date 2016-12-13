#!/usr/bin/env node

console.log('HELLO FROM BILLING-QUERIES!');

const moment = require('moment');
const Storage = require('storj-service-storage-models');
const storage = new Storage(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/__storj-billing-development', process.env.MONGO_OPTIONS || {});
const User = storage.models.User;

const CronJob = require('cron').CronJob;
const job = new CronJob({
  cronTime: '0 0 0 * * *',
  onTick: function() {
    console.log('CronJob Starting - Billing Counts')
    User
      .find({})
      .then(function(users) {
        users.forEach(function(user) {
          const now = moment().utc;
          const endTimestamp = moment.utc(
            `${now.year()}-${now.month()}-${now.date()}`,
            'YYYY-MM-DD'
          );
          const beginTimestamp = moment.utc(endTimestamp).subtract(1, 'day');

          user.generateDebitsForStorage(beginTimestamp, endTimestamp);
          user.generateDebitsForBandwidth(beginTimestamp, endTimestamp);
        })
      });
  },
  start: false,
  timeZone: 'UTC'
});
job.start();
