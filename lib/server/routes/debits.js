'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const authenticate = middleware.authenticate;
const constants = require('../../constants');
const stripe = require('../vendor/stripe');

/**
 * Handles endpoints for all user related operations
 */
function DebitsRouter(options) {
  if (!(this instanceof DebitsRouter)) {
    return new DebitsRouter(options);
  }
  this.models = options.storage.models;
  this._verify = authenticate(this.storage);

  Router.apply(this, arguments);
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
          console.log(`Creating debit for ${user} with no default payment processor`);
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
    ['POST', '/debits', rawbody, this._verify, this.createDebit]
  ];
};

module.exports = DebitsRouter;
