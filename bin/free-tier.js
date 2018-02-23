#!/usr/bin/env node

const Promise = require('bluebird');
const logger = require('../lib/logger');
const program = require('commander');
const Storage = require('storj-service-storage-models');
const BillingClient = require('../lib/utils/billing-client');
const MONGO_USERNAME = process.env.MONGO_USERNAME && process.env.MONGO_USERNAME.match(/\S+/)[0];
const MONGO_PASSWORD = process.env.MONGO_PASSWORD && process.env.MONGO_PASSWORD.match(/\S+/)[0];
const MONGOS = JSON.parse(process.env.MONGOS || 'false');
const REPLSET = JSON.parse(process.env.REPLSET || 'false');
const MONGO_SSL = JSON.parse(process.env.MONGO_SSL || 'false');
const BILLING_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/__storj-bridge-development'
const mongoOptions = {
  user: MONGO_USERNAME,
  pass: MONGO_PASSWORD,
  mongos: MONGOS,
  replset: REPLSET,
  ssl: MONGO_SSL
};

// NB: default (test) key
// matching pubkey: '02439658e54579d120b0fd24d323e413d028704f845b8f7ab5b11e91d6cd5dbb00';
const PRIVKEY = process.env.PRIVKEY ||
  'd6b0e5ac88be1f9c3749548de7b6148f14c2ca8ccdf5295369476567e8c8d218';

function markFreeTier (storage) {
  const User = storage.models.User;
  const PaymentProcessor = storage.models.PaymentProcessor;

  PaymentProcessor.find()
    .then((processors) => {
      processors.forEach((i, index) => {
        console.log('working on processor', i);

        i.adapter.validate().then((isValid) => {
          if (isValid) {
            console.log('validate true')
          }
        })
      })
    })
}

function start () {
  const billingClient = new BillingClient(BILLING_URL, PRIVKEY);
  const storage = new Storage(BILLING_URL, mongoOptions);

  const connectedPromise = new Promise((resolve, reject) => {
    storage.connection.on('connected', resolve);
    storage.connection.on('error', reject);
  });

  connectedPromise
    .then(function () {
      logger.debug('connected')
      markFreeTier(storage)
    })
}

start()