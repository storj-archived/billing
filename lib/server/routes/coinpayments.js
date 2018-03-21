'use strict';

const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const bodyParser = require('body-parser');
const errors = require('storj-service-error-types');
const log = require('../../logger');
const axios = require('axios');
const Promise = require('bluebird');
const Coinpayments = require('coinpayments');
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

CoinpaymentsRouter.prototype._currentPrice = function () {
  return axios.get('https://min-api.cryptocompare.com/data/price?fsym=STORJ&tsyms=USD')
    .then((res) => {
      let currentPrice;
      currentPrice = res.data.USD;

      if (!currentPrice) {
        currentPrice = constants.STORJ_FALLBACK_PRICE
      }
      return currentPrice;
    })
    .catch((err) => {
      log.error('error getting STORJ price', err)
      return constants.STORJ_FALLBACK_PRICE;
    });
}

CoinpaymentsRouter.prototype.handleIPN = function (req, res) {
  log.info('handle ipn request', req.body);
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;
  const Credit = this.models.Credit;
  const User = this.models.User;
  let credit;

  const formatted = {
    amount: parseFloat(req.body.amount).toFixed(8),
    amounti: parseInt(req.body.amounti),
    fee: parseFloat(req.body.fee).toFixed(8),
    feei: parseInt(req.body.feei)
  }

  if (req.body.currency === 'STORJ') {
    PaymentProcessor.findOne({
      'rawData.address': req.body.address
    })
    .then((proc) => {
      return this._currentPrice().then((price) => {
        const data = {
          proc,
          current_price: price
        }
        return data;
      });
    })
    .then((data) => {
      if (!data.proc) {
        return res.status(500).send(errors.BadRequestError('no user found'));
      }

      const USD = (formatted.amount * data.current_price) * 100;
      req.body.usd = USD;

      if (req.body.status !== '100') {
        return Credit.findOne({
          'data.txn_id': req.body.txn_id,
          'user': data.proc.user
        })
        .then((foundCredit) => {
          if (!foundCredit) {
            credit = new Credit({
              paid: false,
              invoiced_amount: USD,
              paid_amount: 0,
              type: constants.CREDIT_TYPES.AUTO,
              user: data.proc.user,
              payment_processor: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
              data: req.body
            });

            return credit.save()
              .then((credit) => {
                log.info('ipn credit created', credit);
                return res.sendStatus(200)
              });
          } else {
            foundCredit.user = data.proc.user;
            foundCredit.paid = false;
            foundCredit.paid_amount = 0;
            foundCredit.invoiced_amount = USD;

            return foundCredit.save()
              .then((credit) => {
                log.info('ipn credit found and updated', credit);
                return res.status(204).end()
              });
          }
        })
        .catch((err) => {
          log.error('error processing ipn: ', err);
          return res.status(500).send(err)
        })
      }

      if (req.body.status === '100') {
        return Credit.findOne({
          'data.txn_id': req.body.txn_id,
          'user': data.proc.user
        })
        .then((credit) => {
          if (!credit) {
            const credit = new Credit({
              paid_amount: USD,
              invoiced_amount: USD,
              user: data.proc.user,
              paid: true,
              payment_processor: constants.PAYMENT_PROCESSORS.COINPAYMENTS,
              type: constants.CREDIT_TYPES.AUTO,
              data: req.body
            });

            self._isFreeTier(credit.user, false)

            return credit.save()
              .then((savedCredit) => {
                log.info('credit created', savedCredit);
                return res.sendStatus(201);
              });
          } else {
            credit.data = req.body;
            credit.paid_amount = USD;
            credit.paid = true;

            self._isFreeTier(credit.user, false)

            return credit.save()
              .then((savedCredit) => {
                log.info('ipn credit found and updated', savedCredit);
                return res.sendStatus(204);
              });
          }
        })
      }
    })
    .catch((err) => {
      log.error('error in ipnHandler: ', err);
    })
  }

  if (req.body.currency === 'BTC') {
    return res.status(501).send(errors.NotImplementedError('bitcoin payments not supported at this time.'));
  }

  if (req.body.currency === 'ETH') {
    return res.status(501).send(errors.NotImplementedError('ethereum payments not supported at this time.'));
  }
}

CoinpaymentsRouter.prototype._isFreeTier = function (user, status) {
  return User.findOne({ _id: user })
    .then((_user) => {
      user.isFreeTier = status;
      return user.save()
    })
    .catch((err) => log.error(`error marking user ${user._id} as isFreeTier ${status}`))
}

CoinpaymentsRouter.prototype._definitions = function () {
  return [
    ['POST', '/coinpayments',
      bodyParser.urlencoded({ extended: true }),
      bodyParser.json(),
      Coinpayments.ipn({
        'merchantId': this.config.coinpayments.merchantId || process.env.CP_MERCHANT_ID,
        'merchantSecret': this.config.coinpayments.merchantSecret || process.env.CP_IPN_SECRET
      }),
      this.handleIPN
    ]
  ]
}

module.exports = CoinpaymentsRouter;
