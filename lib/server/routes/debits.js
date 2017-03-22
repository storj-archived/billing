'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const authenticate = middleware.authenticate;

// TODO: duplicated from service-storge-models `PaymentProcessor`
const getBillingPeriodFor = function(referenceMoment = moment.utc(),
                                     billingDate = moment.utc().date()){
  const endOfBillingMonth = moment
    .utc([referenceMoment.year(), referenceMoment.month()])
    .add(1, 'month')
    .subtract(1, 'day')
    .date();

  const adjustedBillingMoment = (billingDate > endOfBillingMonth) ?
    endOfBillingMonth : billingDate;

  const startMoment = moment.utc([
    referenceMoment.year(),
    referenceMoment.month() - 1,
    adjustedBillingMoment]);
  const endMoment = moment.utc(startMoment).add(1, 'month');

  return {
    startMoment: startMoment,
    endMoment: endMoment
  };
};

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
  const {
    user,
    type,
    amount,
    created,
    storage,
    bandwidth,
    paymentProcessor
  } = req.body;

  if (!user || !type || !amount) {
    return res.sendStatus(400);
  }

  const newDebitPromise = this.models.Debit.create({
    amount,
    type,
    user,
    created,
    storage,
    bandwidth,
    paymentProcessor
  });

  newDebitPromise
    .then((newDebit) => {
      this.models.PaymentProcessor.findOne({user: user, default: true})
        .then((paymentProcessor) => {
          console.log('DEBITS ROUTER PAYMENT PROC', paymentProcessor);
          let billingPeriod;

          billingPeriod = paymentProcessor ?
            paymentProcessor.currentBillingPeriod :
            getBillingPeriodFor();

          try {
            // TODO: refactor this to be payment processor agnostic!
            return this.models.Debit
              .find({
                user: user,
                created: {
                  $gte: billingPeriod.startMoment.toDate(),
                  $lt: billingPeriod.endMoment.toDate()
                }
              })
              .then((debits) => {
                const periodDebitTotal = (debits
                  .reduce((result, debit) => result + debit.amount, 0.0) + 0.0);

                if (paymentProcessor) {
                  // TODO: consider pros/cons of moving call to syncDebits to happen in response to
                  //       stripe's invoice created webhook for payment processor
                  //       agnosticism - i.e. if we pump debits into stripe throughout
                  //       the month, it is more difficult to pay with a different
                  //       processor later.
                  return paymentProcessor.adapter.syncDebits(periodDebitTotal)
                    .then(() => {
                      return res.status(201).json({ debit: newDebit });
                    })
                    .catch((err) => {
                      // console.log('newDebit: %j', newDebit);
                      console.error(err);
                      res.status(500).json({ debit: newDebit, error: err }).end()
                      throw err;
                    });
                }

                return res.status(201).json({ debit: newDebit }).end()
              });
          } catch (err) {
            return Promise.reject(err);
          }
        })
    })
    .catch((err) => {
      console.error(err);
      // TODO Decide whether to send actual error or customer error message
      return res.status(500).json({error: err});
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
