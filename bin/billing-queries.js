#!/usr/bin/env node

console.log('HELLO FROM BILLING-QUERIES!');

const moment = require('moment');
const Storage = require('storj-service-storage-models');
const storage = new Storage('mongodb://localhost:27017/__storj-billing-development');

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
