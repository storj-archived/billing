'use strict';

const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const bodyParser = require('body-parser');
const errors = require('storj-service-error-types');
const log = require('../../logger');
const Promise = require('bluebird');
const Coinpayments = require('coinpayments');
const coinpayments = require('../vendor/coinpayments');
const constants = require('../../constants');
const helperFactory = require('./helpers/credits-helper');

function CoinpaymentsRouter(options) {
  if (!(this instanceof CoinpaymentsRouter)) {
    return new CoinpaymentsRouter(options);
  }

  Router.apply(this, arguments);

  this.models = options.storage.models;
  this.rawbody = middleware.rawbody;
  this.parse = bodyParser();
  this.authenticate = middleware.authenticate(options.storage);
}

inherits(CoinpaymentsRouter, Router);

CoinpaymentsRouter.prototype.handleIPN = function (req, res) {
  const PaymentProcessor = this.models.PaymentProcessor;
  const Credit = this.models.Credit;
  let credit;

  if (req.body.currency === 'STORJ') {
    PaymentProcessor.findOne({
      'rawData.address': req.body.address
    })
    .then((proc) => {
      if (!proc) {
        console.log('no user found for ipn payment', req.body);
        return res.sendStatus(500);
      }

      if (req.body.status === 0) {
        Credit.findOne({
          'data.txn_id': req.body.txn_id,
          'user': proc.user
          })
          .then((foundCredit) => {
            console.log('found credit: ', foundCredit);
            if (!foundCredit) {
              credit = new Credit({
                paid: false,
                invoiced_amount: req.body.amount,
                paid_amount: 0,
                type: 'automatic',
                user: proc.user,
                payment_processor: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
                data: req.body
              });

              credit.save()
                .then(() => {
                  return res.sendStatus(200)
                });
            } else {
              credit.user = proc.user;
              credit.paid = false;
              credit.paid_amount = 0;
              credit.invoiced_amount = req.body.amount;

              return credit.save()
                .then(() => res.sendStatus(200));
            }
          })
          .catch((err) => res.sendStatus(500).send(err));
      }

      if (req.body.status === 100) {
        Credit.findOne({
          'data.txn_id': req.body.txn_id,
          'user': proc.user
        })
        .then((credit) => {
          if (!credit) {
            const credit = new Credit({
              paid_amount: req.body.amount,
              invoiced_amount: req.body.amount,
              user: user,
              paid: true,
              payment_processor: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
              type: 'automatic',
              data: req.body
            });

            return credit.save()
              .then(() => res.sendStatus(200));
          }

          credit.data = req.body;
          credit.paid_amount = req.body.amount;
          credit.paid = true;

          return credit.save()
            .then((credit) => {
              return res.sendStatus(204);
            });
          })
          .catch((err) => res.sendStatus(500));
      }
    })
    .catch((err) => {
      console.log('Error: ', err);
      res.status(500).send('Error finding payment processor: ', err);
    })
  }

  // BTC
  if (req.body.currency === 'BTC') {
    return res.status(501).send(errors.NotImplementedError('bitcoin payments not supported at this time.'));
  }

  return res.status(501).send(errors.NotImplementedError('currency not supported'));
}

CoinpaymentsRouter.prototype._definitions = function () {
  return [
    ['POST', '/coinpayments',
      bodyParser.json(),
      bodyParser.urlencoded({ extended: true }),
      CoinPayments.ipn({
        'merchantId': process.env.CP_MERCHANT_ID,
        'merchantSecret': process.env.CP_IPN_SECRET
      }),
      this.handleIPN
    ]
  ]
}

module.exports = CoinpaymentsRouter;
