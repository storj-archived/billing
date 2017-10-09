'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');
const StorjMailer = require('storj-service-mailer');
const defaults = require('../../config.js').DEFAULTS;
const mailer = new StorjMailer(defaults.mailer);
const log = require('../../logger');

function PaymentProcessorsRouter(options) {
  if (!(this instanceof PaymentProcessorsRouter)) {
    return new PaymentProcessorsRouter(options);
  }

  Router.apply(this, arguments);
  this.models = options.storage.models;
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
      .catch((err) => {
        reject(err)
      });
  });
};

PaymentProcessorsRouter.prototype._setUserFreeTier = function(req, isFreeTier) {
  const User = this.models.User;
  return User.findByIdAndUpdate(req.user.id, {$set: { isFreeTier: isFreeTier }}, {runValidators: true}, (err, user) => {
    if (err) return err;
    return user;
  });
}

PaymentProcessorsRouter.prototype.addPaymentMethod = function(req, res, next) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;
  const User = this.models.User;

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
      self._setUserFreeTier(req, false);
      mailer.dispatch(req.user._id, 'add-card', {}, (err) => {
        log.info('error sending add-card email', req.user._id, err)
      });
      return res.status(200).send({
        pp,
        user: req.user
      });
    })
};

PaymentProcessorsRouter.prototype.removePaymentMethod = function(req, res, next) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;
  const ppId = req.body.ppId;
  const methodId = req.body.methodId;

  PaymentProcessor.findOne({ _id: ppId })
    .then((pp) => {
      if (pp.paymentMethods.length <= 0) {
        return res.status(200).send(`No payment processor id ${ppId}`);
      }

      pp.adapter.removePaymentMethod(methodId);
      mailer.dispatch(req.user._id, 'remove-card', {}, (err) => {
        if (err) log.error('Error sending remove-card email', err);
      });

      return pp;
    })
    .then(pp => {
      const user = self._setUserFreeTier(req, true);

      return res.status(200).json({
        user,
        pp
      });
    });
};

PaymentProcessorsRouter.prototype.getDefaultPP = function(req, res, next) {
  const PaymentProcessor = this.models.PaymentProcessor;

  PaymentProcessor
    .findOne({ user: req.user.id, default: true })
    .then((result) => {
      if (result) {
        return res.status(200).send({ pp: result.toObject() });
      }
      return res.status(200).send({ pp: null });
    })
    .catch((err) => {
      res.status(500).send(err);
    })
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
    ]
  ];
};

module.exports = PaymentProcessorsRouter;
