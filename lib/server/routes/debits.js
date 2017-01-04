'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
// const errors = require('../errors');
const authenticate = middleware.authenticate;
const constants = require('../../constants');
const STRIPE = constants.PAYMENT_PROCESSORS.STRIPE;
const CREDIT_TYPES = constants.CREDIT_TYPES;
const paymentProcessorAdapters = require('storj-service-storage-models/models/payment-processor-adapters');
const stripe = require('../vendor/stripe');

/**
 * Handles endpoints for all user related operations
 */
function DebitsRouter(options) {
  if (!(this instanceof DebitsRouter)) {
    return new DebitsRouter(options);
  }
  this.models = options.storage.models;

  Router.apply(this, arguments);
  // this._verify = authenticate(this.storage);
}

inherits(DebitsRouter, Router);

DebitsRouter.prototype.verify = function(req, res, next) {
  // TODO: FIX ME! NO AUTHENTICATION!!!!
  next(null);
};

DebitsRouter.prototype.createDebit = function(req, res) {
  console.log('body: %j', req.body);
  const user = req.body.user;
  const type = req.body.type;
  const amount = req.body.amount;

  if (!user || !type || !amount) {
    res.sendStatus(400);
  }

  this.models.User.findOne({_id: user})
      .then((user) => {
        const debit = new this.models.Debit({
          amount: amount,
          type: type,
          user: user
        });
        return Proimse.all([
          debit.save(),
          Promise.resolve(user)
        ]);
      }, (err) => {
        console.error(`User lookup failed for user: ${user}`);
        return Promise.reject(err);
      })
      .then((results) => {
        const debit = results[0];
        const user = results[1];

        if (user.paymentProcessors.length === 0) {
          console.log(`No payment processor for user: ${user.email}`);
          return res.status(201).json({debit: debit, warning: 'no payment processors!'}).end();
        } else {
          const customerId = user.paymentProcessors
              .find((processor) => (processor.name === STRIPE))
              .data.customer.id;

          stripe.invoiceItems.create({
            customer: customerId,
            amount: debit.amount,
            currency: 'usd',
            description: [
              'Storj.io Usage Charge - ',
              debit.type
            ].join('')
          }, (err, invoiceItem) => {
            if (err) {
              console.error(err);
              // TODO Decide whether to send actual error or customer error message
              return res.status(202).json({debit: debit, error: err})
            }

            console.log('Invoice item created: ', invoiceItem);
            return res.status(201).json({debit: debit, invoice: invoiceItem}).end();
          });
        }
      })
      .catch((err) => {
        console.error(err);
        // TODO Decide whether to send actual error or customer error message
        return res.status(400).json({error: err}).end();
      })
};

/**
 * Export definitions
 * @private
 */
DebitsRouter.prototype._definitions = function() {
  return [
    ['POST', '/debits', rawbody, this.verify, this.createDebit]
  ];
};

module.exports = DebitsRouter;
