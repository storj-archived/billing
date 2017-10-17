'use strict';

const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');
const log = require('../../logger');
const coinpayments = require('../vendor/coinpayments');
const constants = require('../../constants');

function PaymentProcessorsRouter(options) {
  if (!(this instanceof PaymentProcessorsRouter)) {
    return new PaymentProcessorsRouter(options);
  }

  Router.apply(this, arguments);

  this.models = options.storage.models;
  this.rawbody = middleware.rawbody;
  this.authenticate = middleware.authenticate(options.storage);
}

inherits(PaymentProcessorsRouter, Router);

PaymentProcessorsRouter.prototype._addPaymentProcessor = function(req) {
  const PaymentProcessor = this.models.PaymentProcessor;

  return new Promise((resolve, reject) => {
    const pp = new PaymentProcessor({
      user: req.user.id,
      name: req.body.processor.name,
      default: req.body.processor.default
    });

    pp.adapter.register(req.body.data, req.user.id)
      .then((result) => {
        pp.data = result;
        pp.save()
          .then((pp) => resolve(pp))
          .catch((err) => reject(err));
      })
      .catch((err) => reject(err));
  });
};

PaymentProcessorsRouter.prototype._setUserFreeTier = function(req, isFreeTier) {
  const User = this.models.User;
  return User.findByIdAndUpdate(req.user.id,
    {$set: { isFreeTier: isFreeTier }},
    {runValidators: true},
    (err, user) => {
      if (err) return err;
      return user;
    });
}

PaymentProcessorsRouter.prototype.addPaymentMethod = function(req, res) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;

  return PaymentProcessor
    .findOne({
      user: req.user.id,
      name: req.body.processor.name
    })
    .then((pp) => {

      if (pp) {
        pp.addPaymentMethod(req.body.data);
        return pp;
      }

      self._addPaymentProcessor(req);

      return pp;
    })
    .then((pp) => {

      // set user to free tier
      self._setUserFreeTier(req, false);

      return res.status(200).send({
        pp,
        user: req.user
      });
    });
};

PaymentProcessorsRouter.prototype.handleCreateAddress = function (req, res) {
  const User = this.models.User;

  if (!req.body.currency) {
    return res.status(400)
      .send(errors.BadRequestError('must specify a wallet currency!'));
  }

  const currency = req.body.currency.toLowerCase();

  return User.findOne({ _id: req.user.id })
    .then((user) => {
      if (constants.ACCEPTED_CURRENCIES.indexOf(currency) === -1) {
        return res.send(errors.BadRequestError('not a valid currency type'));
      }

      if (user.wallets[currency]) {
        return this.getWallets(req, res);
      }

      coinpayments.getCallbackAddress(currency, function (err, result) {
        if (err) {
          log.error('error getting callback address from coinpayments', err);
          return res.status(500).send(errors.InternalError());
        }

        user.wallets[currency] = result.address;
        user.save()
          .then((savedUser) => {
            log.info('added wallet to user', savedUser);
            return res.status(200).send({
              user: savedUser,
              address: result.address
            })
          })
      });
    })
    .catch((err) => {
      log.error('error creating new crypto wallet address', err);
      return res.status(500).send(errors.InternalError());
    });
};

PaymentProcessorsRouter.prototype.getWallets = function (req, res, next) {
  const self = this;
  const User = this.models.User;

  return User.findById(req.user.id)
    .then((user) => res.status(200).send({ wallets: user.wallets }))
    .catch((err) => res.status(500).send(err));
}

PaymentProcessorsRouter.prototype.removePaymentMethod = function(req, res) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;
  const ppId = req.body.ppId;
  const methodId = req.body.methodId;

  return PaymentProcessor.findOne({ _id: ppId })
    .then((pp) => {
      if (pp.paymentMethods.length <= 0) {
        log.error('No payment methods to remove.');
        return res.status(200).send(`No payment processor id ${ppId}`);
      }

      pp.adapter.removePaymentMethod(methodId);

      return pp;
    })
    .then(pp => {
      const user = self._setUserFreeTier(req, true);
      return res.status(200).json({
        user,
        pp
      });
    })
    .catch((err) => {
      log.error('Error removing payment method: ', err);
      return res.status(500).send(errors.InternalError());
    });
};

PaymentProcessorsRouter.prototype.getDefaultPP = function(req, res) {
  const PaymentProcessor = this.models.PaymentProcessor;

  return PaymentProcessor
    .findOne({ user: req.user.id, default: true })
    .then((result) => {
      if (result) {
        return res.status(200).send({ pp: result.toObject() });
      }
      return res.status(200).send({ pp: null });
    })
    .catch((err) => {
      log.error('Error getting default payment processor: ', err);
      res.status(500).send(errors.InternalError());
    });
};

/**
 * Export definitions
 * @private
 */
PaymentProcessorsRouter.prototype._definitions = function() {
  return [
    ['POST', '/pp/method/add',
      this.authenticate,
      this.addPaymentMethod
    ],
    ['POST','/pp/method/remove',
      this.authenticate,
      this.removePaymentMethod
    ],
    ['GET', '/pp/default',
      this.authenticate,
      this.getDefaultPP
    ],
    ['POST', '/pp/wallets',
      this.authenticate,
      this.handleCreateAddress
    ],
    ['GET', '/pp/wallets',
      this.authenticate,
      this.getWallets
    ]
  ];
};

module.exports = PaymentProcessorsRouter;
