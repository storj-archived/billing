'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;
const stripe = require('../vendor/stripe');

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
  console.log('Req header x-signature: %j', req.header('x-signature'));
  console.log('Req header x-pubkey: %j', req.header('x-pubkey'));

  const user = req.body.user;
  const type = req.body.type;
  const amount = req.body.amount;
  const created = req.body.created;

  if (!user || !type || !amount) {
    res.sendStatus(400);
  }

  const newDebitPromise = this.models.Debit.create({
    amount: amount,
    type: type,
    user: user,
    created: created
  });

  newDebitPromise
    .then((newDebit) => {
      this.models.PaymentProcessor.findOne({user: user, default: true})
        .then((paymentProcessor) => {
          if (!paymentProcessor) {
            console.log(`Creating debit for ${user} with no default payment processor`);
            return res.status(201).json({debit: newDebit, warning: 'no default payment processors!'}).end();
          } else {

            // NB: moment#month() is 0 indexed, but #year() & #date() are not
            //     and the array constructor (e.g. moment.utc([<year>, <month>, <date>])
            //     expects this!
            console.log('payment processsor exsists...');
            try {
              console.log('trying...');
              // TODO: refactor this to be payment processor agnostic!
              const customerId = paymentProcessor.data.customer.id;
              const billingPeriod = paymentProcessor.currentBillingPeriod;

              console.log('customerId: %j', customerId);
              console.log('billingPeriod: %j', billingPeriod);

              return this.models.Debit
                .find({
                  user: user,
                  created: {
                    $gte: billingPeriod.startMoment.toDate(),
                    $lt: billingPeriod.endMoment.toDate()
                  }
                })
                // NB: mongo probably won't read the debit it just wrote so we
                //     check for it here.
                // .then(debits => {
                //   return (debits.findIndex((debit) => debit._id === newDebit._id) == -1) ?
                //     debits.concat([newDebit]) : debits;
                // })
                .then((debits) => {
                  console.log('found debits: %j', debits.map(d => ({id: d._id, amount: d.amount})));
                  console.log('debits count: %j', debits.length);
                  const periodDebitTotal = (debits
                    .reduce((result, debit) => result + debit.amount, 0.0) + 0.0);

                  console.log('debitTotal: %j', periodDebitTotal);

                  // TODO: consider pros/cons of moving call to balanceDebits to happen in response to
                  //       stripe's invoice created webhook for payment processor
                  //       agnosticism - i.e. if we pump debits into stripe throughout
                  //       the month, it is more difficult to pay with a different
                  //       processor later.
                  paymentProcessor.adapter.balanceDebits(customerId, periodDebitTotal)
                    .then((invoiceItem) => {
                      // console.log('newDebit: %j', newDebit);
                      console.log('invoice item created!!: %j', invoiceItem);
                      console.log('status 201');
                      return res.status(201).json({debit: newDebit, invoiceItem: invoiceItem}).end()
                    })
                    .catch((err) => {
                      // console.log('newDebit: %j', newDebit);
                      console.log('invoice item error:');
                      console.error(err);
                      console.log('status 202');
                      res.status(202).json({debit: newDebit, error: err}).end()
                      throw err;
                    });
                });
            } catch (err) {
              return Promise.reject(err);
            }
          }
        })
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
