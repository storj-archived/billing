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
  log.info('ipn received', req.body);

  const PaymentProcessor = this.models.PaymentProcessor;
  const Credit = this.models.Credit;

  let credit;

  if (req.body.currency === 'STORJ') {
    PaymentProcessor.findOne({
      'rawData.address': req.body.address
    })
    .then((proc) => {
      if (!proc) {
        log.error('no user found for ipn payment address %s', req.body.address, req.body);
        return res.status(500).send('no user found');
      }

      if (req.body.status < 100) {
        return Credit.findOne({
          'data.txn_id': req.body.txn_id,
          'user': proc.user
        })
        .then((foundCredit) => {
          if (!foundCredit) {
            credit = new Credit({
              paid: false,
              invoiced_amount: req.body.amount,
              paid_amount: 0,
              type: constants.CREDIT_TYPES.MANUAL,
              user: proc.user,
              payment_processor: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
              data: req.body
            });

            return credit.save()
              .then((credit) => {
                log.info('ipn credit created', credit);
                return res.sendStatus(200)
              });
          } else {
            foundCredit.user = proc.user;
            foundCredit.paid = false;
            foundCredit.paid_amount = 0;
            foundCredit.invoiced_amount = req.body.amount;

            return foundCredit.save()
              .then(() => res.status(204).end());
          }
          })
          .catch((err) => {
            log.error('err status < 100: ', err);
            return res.status(500).send(err)
          })
      }

      if (req.body.status === 100) {
        return Credit.findOne({
          'data.txn_id': req.body.txn_id,
          'user': proc.user
        })
        .then((credit) => {
          if (!credit) {
            const credit = new Credit({
              paid_amount: req.body.amount,
              invoiced_amount: req.body.amount,
              user: proc.user,
              paid: true,
              payment_processor: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
              type: constants.CREDIT_TYPES.AUTO,
              data: req.body
            });

            return credit.save()
              .then(() => res.sendStatus(201));
          }

          credit.data = req.body;
          credit.paid_amount = req.body.amount;
          credit.paid = true;

          return credit.save()
            .then((credit) => {
              log.info('ipn credit found and updated', credit);
              return res.sendStatus(204);
            });
          })
      }
    })
    .catch((err) => {
      log.error('error in ipnHandler: ', err);
      return res.status(500).send('error handling ipn request');
    })
  }

  if (req.body.currency === 'BTC') {
    return res.status(501).send(errors.NotImplementedError('bitcoin payments not supported at this time.'));
  }
}

CoinpaymentsRouter.prototype._definitions = function () {
  return [
    ['POST', '/coinpayments',
      bodyParser.json(),
      bodyParser.urlencoded({ extended: true }),
      Coinpayments.ipn({
        'merchantId': process.env.CP_MERCHANT_ID,
        'merchantSecret': process.env.CP_IPN_SECRET
      }),
      this.handleIPN
    ]
  ]
}

module.exports = CoinpaymentsRouter;
