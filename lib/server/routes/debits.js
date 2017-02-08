'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;
const constants = require('../../constants');
const stripe = require('../vendor/stripe');
const graphqlService = require('../graphql');

/**
 * Handles endpoints for all user related operations
 */
function DebitsRouter(options) {
  if (!(this instanceof DebitsRouter)) {
    return new DebitsRouter(options);
  }

  Router.apply(this, arguments);

  this.models = options.storage.models;
  this._verify = authenticate(this.storage);
}

inherits(DebitsRouter, Router);

DebitsRouter.prototype.createDebit = function(req, res) {
  const user = req.body.user;
  const type = req.body.type;
  const amount = req.body.amount;
  const created = req.body.created;

  if (!user || !type || !amount) {
    res.sendStatus(400);
  }

  graphqlService.defaultPaymentProcessor
    .then((paymentProcessor) => {
      if (!paymentProcessor) {
        console.log(`Creating debit for ${user} with no default payment processor`);
        return res.status(201).json({debit: debit, warning: 'no default payment processors!'}).end();
      } else {

        // NB: moment#month() is 0 indexed, but #year() & #date() are not
        //     and the array constructor (e.g. moment.utc([<year>, <month>, <date>])
        //     expects this!
        try {
          // TODO: refactor this to be payment processor agnostic!
          const customerId = paymentProcessor.data.customer.id;
          const billingDate = paymentProcessor.data.billingDate;
          const today = moment.utc();
          const endOfBillingMonth = moment
            .utc([today.year(), today.month()])
            .add(1, 'month')
            .subtract(1, 'day')
            .date();

          const adjustedBillingDate = (billingDate > endOfBillingMonth) ?
            endOfBillingMonth : billingDate;

          const startDate = moment.utc([today.year(), today.month(), adjustedBillingDate]);
          const endDate = moment.utc(startDate).add(1, 'month');

          return this.models.Debit
            .find({
              user: user,
              created: {
                $gte: startDate.toDate(),
                $lt: endDate.toDate()
              }
            })
            .then(debits => {
              return this.models.Debit.create({
                amount: amount,
                type: type,
                user: user,
                created: created
              })
                .then(debit => debits.concat([debit]));
            })
            .then((debits) => {
              paymentProcessor.balanceDebits(debits)
                .then((invoiceItem) => res.status(201).json({debit: debit, invoice: invoiceItem}).end())
                .catch((err) => res.status(202).json({debut: debit, error: err}).end());
            });
        } catch (err) {
          return Promise.reject(err);
        }
      }
    })
    .catch((err) => {
      console.error(err);
      // TODO Decide whether to send actual error or customer error message
      return res.status(500).json({error: err}).end();
    })
};

/**
 * Export definitions
 * @private
 */
DebitsRouter.prototype._definitions = function() {
  return [
    ['POST', '/debits', this._verify, this.createDebit]
  ];
};

module.exports = DebitsRouter;
