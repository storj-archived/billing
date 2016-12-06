'use strict';

const Router = require('./index');
const middleware = require('storj-service-middleware');
const log = require('../../logger');
const authenticate = middleware.authenticate;
const constants = require('../../constants');
const DEBIT_TYPES = constants.DEBIT_TYPES;
const queries = require('../queries');
const CronJob = require('cron').CronJob;

//Test that this gives me access to Debits routes
const Debits = Router.DebitsRouter;

function BillingActionsRouter(options) {
  if (!(this instanceof BillingActions)) {
    return new BillingActions(options);
  }
  this.models = options.storage.models;
  Router.apply(this, arguments);
  // this._verify = authenticate(this.storage);
}

inherits(BillingActions, Router);

const billingCycle = new CronJob({
  cronTime: '0 0 12 1/1 * ? *',
  onTick: function() {
    /* Runs every day (Monday through Sunday) at 12:00:00 PM (noon).*/
    createDebits();
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});

function createDebits() {
  //Get all Users
  const User = this.models.User;
  const users = User.find({});
  console.log(users);

  //get access to DebitsRouter

  users.forEach(function(user) {
    const id = user.id;
    console.log('userID: ', user.id);
    const amountOwedStorage = queries.calculateUserAmountOwedForStorage(id, );
    const amountOwedBandwidth = queries.calculateUserAmountOwedForBandwidth();
    const total = amountOwedBandwidth + amountOwedStorage;

    // create debit on user account for billed amount
    Debits.prototype.createDebit(id, type, total);
    log('Debit added: ', id, type, total);
  })
}
billingCycle.start();
