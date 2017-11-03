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

CoinpaymentsRouter.prototype.handleIPN = (req, res) => {
  log.info('ipn received', req.body);

  const Credit = this.models.Credit;

  let credit;

  if (req.body.currency === 'STORJ') {
    PaymentProcessor.findOne({
      'data.address': req.body.address
    }, (err, proc) => {
      if (err) {
        log.error('error finding payment processor by address', err);
      }

      if (!proc) {
        return log.error('no user found for ipn payment', req.body);
      }

      if (req.body.status === 0) {
        Credit.findOne({
          'data.txn_id': req.body.txn_id
          'user': proc.user
          })
          .then(foundCredit => {
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

              return credit.save();
            } else {
              credit.user = proc.user;
              credit.paid = false;
              credit.paid_amount = 0;
              credit.invoiced_amount = req.body.amount;

              return credit.save();
            }

          })
          .catch(err => log.error('error finding credit', err));
      }

      if (req.body.status === 100) {
        Credit.findOne({
          'data.txn_id': req.body.txn_id,
          'user': proc.user
          })
          .then(credit => {
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

              return credit.save();
            }

            credit.data = req.body;
            credit.paid_amount = req.body.amount;
            credit.paid = true;

            return credit.save()
          });
      }
    });
  };
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
