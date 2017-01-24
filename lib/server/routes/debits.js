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
const paymentProcessorAdapters = require('storj-service-storage-models/lib/models/payment-processor-adapters');
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
  const created = req.body.created;

  if (!user || !type || !amount) {
    res.sendStatus(400);
  }

  this.models.PaymentProcessor.findOne({user: user, default: true})
      .then((paymentProcessor) => {
        const debit = new this.models.Debit({
          amount: amount,
          type: type,
          user: user,
          created: created
        });
        return Promise.all([
          debit.save(),
          Promise.resolve(paymentProcessor)
        ]);
      }, (err) => {
        console.error(`User lookup failed for user: ${user}`);
        return Promise.reject(err);
      })
      .then((results) => {
        const debit = results[0];
        const paymentProcessor = results[1];

        if (!paymentProcessor) {
          console.log(`No default payment processor for user: ${user}`);
          return res.status(201).json({debit: debit, warning: 'no default payment processors!'}).end();
        } else {
          // TODO: refactor this to be payment processor agnostic!
          const customerId = paymentProcessor.data.customer.id;

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
