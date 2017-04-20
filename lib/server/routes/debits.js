'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');

// TODO: duplicated from service-storge-models `PaymentProcessor`

function DebitsRouter(options) {
  if (!(this instanceof DebitsRouter)) {
    return new DebitsRouter(options);
  }

  Router.apply(this, arguments);

  this.models = options.storage.models;
  this.authenticate = middleware.authenticate(options.storage);
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
          console.log(paymentProcessor);

          let billingPeriod;

          billingPeriod = paymentProcessor ?
            paymentProcessor.currentBillingPeriod :
            this._getBillingPeriodFor();

          try {
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
                      res.status(500).json({ debit: newDebit, error: err }).end()
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
      return res.status(500).json({error: err});
    })
};


DebitsRouter.prototype.getDebits = function(req, res, next) {
  console.log('DEBITS: body', req.body, 'params', req.params, 'query', req.query);
  const Debit = this.models.Debit;

  if (!req.query.startDate && !req.query.endDate) {
    return Debit.find({ user: req.user.id })
      .then((debits) => {
        const debitObjects = debits.map((debit) => debit.toObject());
        res.status(200).send(debitObjects);
      })
      .catch((err) => next(new errors.InternalError(err.message)));
  }

  Debit.find({
    user: req.user.id,
    created: {
      $gte: moment.utc(parseInt(req.query.startDate, 0)),
      $lt: moment.utc(parseInt(req.query.endDate, 0))
    }
  }, function(err, debits) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }
    res.status(200).send(debits.map(debit => debit.toObject()));
  })
};

DebitsRouter.prototype._getBillingPeriodFor = function(referenceMoment = moment.utc(),
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
 * Export definitions
 * @private
 */
DebitsRouter.prototype._definitions = function() {
  return [
    ['POST', '/debits',
      this.authenticate,
      this.createDebit
    ],
    ['GET', '/debits',
      this.authenticate,
      this.getDebits
    ]
  ];
};

module.exports = DebitsRouter;
