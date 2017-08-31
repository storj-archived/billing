'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');

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

// PaymentProcessorsRouter.prototype._setUserFreeTier = function(req, isFreeTier) {
//   return new Promise((resolve, reject) => {
//     const user = req.user;
//     user.isFreeTier = isFreeTier;
//     user.save()
//       .then((user) => resolve(user))
//       .catch((err) => reject(err));
//   });
// };

PaymentProcessorsRouter.prototype._setUserFreeTier = function(req, isFreeTier) {
  const User = this.models.User;
  return User.findByIdAndUpdate(req.user.id, {$set: { isFreeTier: isFreeTier }}, {runValidators: true}, (err, user) => {
    if (err) return err;
    return user;
  });
}

// PaymentProcessorsRouter.prototype.addPaymentMethod = function(req, res, next) {
//   const self = this;
//   const PaymentProcessor = this.models.PaymentProcessor;
//   const userId = req.user.id;
//   const processorName = req.body.processor.name;
//
//   Promise.coroutine(function* () {
//     const processor = yield PaymentProcessor.findOne({
//       user: userId, name: processorName
//     });
//
//     !processor
//       ? yield self._addPaymentProcessor(req)
//       : yield processor.addPaymentMethod(req.body.data);
//
//     Promise.join(
//       PaymentProcessor.findOne({ user: userId, name: processorName }),
//       self._setUserFreeTier(req, false),
//       function (pp, user) {
//         res.status(200).send({ pp: pp.toObject(), user });
//       }
//     );
//   })().catch((err) => {
//     console.error('ADD PAYMENT METHOD ERROR', err);
//     res.status(500).send(new errors.InternalError(err));
//   });
// };

PaymentProcessorsRouter.prototype.addPaymentMethod = function(req, res, next) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;
  const User = this.models.User;

  console.log('req.user: ', req.user);

  return PaymentProcessor
    .findOne({
      user: req.user.id,
      name: req.body.processor.name
    })
    .then((pp) => {
      console.log('PP: ', pp);

      if (pp) {
        pp.addPaymentMethod(req.body.data);
        console.log('added payment method with', req.body.data);
        return pp;
      }

      self._addPaymentProcessor(req);
      console.log('added payment processor');

      return pp;
    })
    .then((pp) => {

      // set user to free tier
      self._setUserFreeTier(req, false);

      console.log('set to free tier');

      // respond
      return res.status(200).send({
        pp,
        user: req.user
      });
    })
};

// PaymentProcessorsRouter.prototype.removePaymentMethod = function(req, res, next) {
//   const PaymentProcessor = this.models.PaymentProcessor;
//   const ppId = req.body.ppId;
//   const methodId = req.body.methodId;
//   const self = this;
//
//   Promise.coroutine(function* () {
//     const pp = yield PaymentProcessor.findOne({ _id: ppId });
//
//     if (pp.paymentMethods.length <= 0) {
//       console.log('No payment methods to remove');
//       return res.status(200).send(
//         `No payment processor with ${ppId} id`
//       );
//     }
//
//     yield pp.adapter.removePaymentMethod(methodId)
//
//     const user = yield self._setUserFreeTier(req, true);
//     const newPP = yield PaymentProcessor.findOne({ _id: ppId });
//
//     res.status(200).send({ user, pp: newPP });
//   })().catch((err) => {
//     console.error('REMOVE PAYMENT METHOD err', err.message);
//     res.status(err.status || 500).send(err)
//   });
// };

PaymentProcessorsRouter.prototype.removePaymentMethod = function(req, res, next) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;
  const ppId = req.body.ppId;
  const methodId = req.body.methodId;

  PaymentProcessor.findOne({ _id: ppId })
    .then((pp) => {
      if (pp.paymentMethods.length <= 0) {
        console.error('No payment methods to remove.');
        return res.status(200).send(`No payment processor id ${ppId}`);
      }

      console.log('removing method', methodId);
      pp.adapter.removePaymentMethod(methodId);

      return pp;
    })
    .then(pp => {
      const user = self._setUserFreeTier(req, true);
      console.log('user: ', user);
      console.log('pp: ', pp);

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
      console.error('Error #getDefaultPP', err);
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
