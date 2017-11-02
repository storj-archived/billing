'use strict';

const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const bodyParser = require('body-parser');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');
const log = require('../../logger');
const CoinPayments = require('coinpayments');
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

PaymentProcessorsRouter.prototype._addProcessor = function(data) {
  const Processor = this.models.PaymentProcessor;
  return new Promise((resolve, reject) => {
    const pp = new Processor({
      user: data.user,
      name: data.name,
      default: data.default
    });

    return pp.save()
      .then((pp) => resolve(pp))
      .catch((err) => reject(err));
    });
}

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
        return pp.addPaymentMethod(req.body.data);
      }

      return self._addPaymentProcessor(req);
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

PaymentProcessorsRouter.prototype.getWallets = function (req, res, next) {
  const self = this;
  const Processor = this.models.PaymentProcessor;

  return Processor.findOne({
      user: req.user.id,
      name: constants.PAYMENT_PROCESSORS.COINPAYMENTS
    })
    .then((processor) => {
      if (!processor) {
        const pp = new Processor({
          user: req.user.id,
          name: constants.PAYMENT_PROCESSORS.COINPAYMENTS
        });

        return pp.save()
          .then((proc) => res.status(201).send(proc))
          .catch((err) => res.status(500).send(errors.InternalError()))
      }

      return res.status(200).send(processor.paymentMethods);
    })
    .catch((err) => {
      log.error('error finding payment processors %s', err);
      res.status(500).send('error getting wallets', err)
    });
}

PaymentProcessorsRouter.prototype._addWallet = function(req, res) {
  const self = this;
  const PaymentProcessor = this.models.PaymentProcessor;

  return PaymentProcessor.findOne({
    user: req.user.id,
    name: req.body.currency
  })
  .then((processor) => {
    if (!processor) {
      // create new payment processor
        const pp = new PaymentProcessor({
          user: req.user.id,
          name: req.body.processor,
          default: false
        });

        return pp.save()
          .then((proc) => {
            console.log('payment processor created: ', proc);
            proc.addPaymentMethod(req.body.currency)
              .then((response) => {
                console.log('added payment method: ', res);
                return res.status(201).send(response);
              });
          });
    }

    return processor.addPaymentMethod(req.body.currency)
      .then((proc) => {
        console.log('added payment method with %s %s', req.body.currency, proc);
        return res.status(201).json(proc);
      })
  })
  .catch((err) => res.status(500).send(errors.InternalError()));
}

PaymentProcessorsRouter.prototype.createWallets = function(req, res) {
  const PaymentProcessor = this.models.PaymentProcessor;

  PaymentProcessor.findOne({
    user: req.user.id,
    name: constants.PAYMENT_PROCESSORS.COINPAYMENTS
  })
  .then((processor) => {
    log.info('found processor %s', processor);

    processor.addPaymentMethod(req.body.currency)
      .then((response) => {
        console.log('response: ', response);
        return res.status(201).send(response)
      })
      .catch((err) => {
        console.error('Error adding payment method: ', err);
        return res.status(500).send('Error adding payment method: ', err);
      });
  });
}

PaymentProcessorsRouter.prototype.removeWallet = function (req, res) {
  const PaymentProcessor = this.models.PaymentProcessor;

  return PaymentProcessor.findOne({
    user: req.user.id,
    name: constants.PAYMENT_PROCESSORS.COINPAYMENTS
  })
  .then((proc) => {
    log.info('found processor %s', proc);

    return proc.removePaymentMethod(req.params.address)
      .then((processor) => {
        log.info('wallet removed %s', processor)
        return res.status(200).send(processor)
      })
  })
  .catch((err) => {
    log.error('error removing wallet: %s', err)
    return res.status(500)
      .send(errors.InternalError('error removing wallet'));
  });
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
      //TODO: we need to check for payment methods before setting to true
      // Right now, this just assumes they have none
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
    ['GET', '/pp/wallets',
      this.authenticate,
      this.getWallets
    ],
    ['POST', '/pp/wallets',
      this.authenticate,
      this.createWallets
    ],
    ['DELETE', '/pp/wallets/:address',
      this.authenticate,
      this.removeWallet
    ]
  ];
};

module.exports = PaymentProcessorsRouter;
