'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');
const analytics = require('storj-analytics');

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
      .catch((err) => reject(err));
  });
};

PaymentProcessorsRouter.prototype._setUserFreeTier = function(req, isFreeTier) {
  return new Promise((resolve, reject) => {
    const user = req.user;
    user.isFreeTier = isFreeTier;
    user.save()
      .then((user) => resolve(user))
      .catch((err) => reject(err));
  });
};

PaymentProcessorsRouter.prototype.addPaymentMethod = function(req, res, next) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;
  const userId = req.user.id;
  const processorName = req.body.processor.name;

  Promise.coroutine(function* () {
    const processor = yield PaymentProcessor.findOne({
      user: userId, name: processorName
    });

    !processor
      ? yield self._addPaymentProcessor(req)
      : yield processor.addPaymentMethod(req.body.data);

    Promise.join(
      PaymentProcessor.findOne({ user: userId, name: processorName }),
      self._setUserFreeTier(req, false),
      function (pp, user) {
        analytics.track(user.preferences.dnt, {
          userId: user.uuid,
          event: 'Added Payment Method',
          properties: {
            processor: pp.name
          }
        });

        res.status(200).send({ pp: pp.toObject(), user });
      }
    );
  })().catch((err) => {
    console.error('ADD PAYMENT METHOD ERROR', err);
    res.status(500).send(new errors.InternalError(err));
  });
};

PaymentProcessorsRouter.prototype.removePaymentMethod = function(req, res, next) {
  const PaymentProcessor = this.models.PaymentProcessor;
  const ppId = req.body.ppId;
  const methodId = req.body.methodId;
  const self = this;

  Promise.coroutine(function* () {
    const pp = yield PaymentProcessor.findOne({ _id: ppId });

    if (pp.paymentMethods.length <= 0) {
      console.log('No payment methods to remove');
      return res.status(200).send(
        `No payment processor with ${ppId} id`
      );
    }

    yield pp.adapter.removePaymentMethod(methodId)

    const user = yield self._setUserFreeTier(req, true);
    const newPP = yield PaymentProcessor.findOne({ _id: ppId });

    res.status(200).send({ user, pp: newPP });
  })().catch((err) => {
    console.error('REMOVE PAYMENT METHOD err', err.message);
    res.status(err.status || 500).send(err)
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
      res.status(200).send({ pp: null });
    })
    .catch((err) => {
      console.error('GET DEFAULT PP', err);
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
