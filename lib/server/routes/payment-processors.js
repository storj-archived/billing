'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');

function PaymentProcessorsRouter(options) {
  if (!(this instanceof PaymentProcessorsRouter)) {
    return new PaymentProcessorsRouter(options);
  }

  Router.apply(this, arguments);

  this.models = options.storage.models;
  this.authenticate = middleware.authenticate(options.storage);
}

inherits(PaymentProcessorsRouter, Router);

PaymentProcessorsRouter.prototype.addPP = function(req, res, next) {
  console.log('hai', req.body);
  const PaymentProcessor = this.models.PaymentProcessor;

  const pp = new PaymentProcessor({
    user: req.user.id,
    name: req.body.processor.name,
    default: req.body.processor.default
  });

  pp.adapter
    .register(req.body.data, req.user.id)
    .then((result) => {
      console.log('result from pp', result);
      pp.data = result;
      pp.save()
        .then((pp) => {
          console.log('pppp', pp);
          res.status(200).send(pp.toObject());
        })
        .catch((err) => res.status(500).send(err));
    });
    // still need to convert user if successful
    // and then verify if there are more, and then addPaymentMethod if needed
};

PaymentProcessorsRouter.prototype.removePP = function(req, res, next) {

};

PaymentProcessorsRouter.prototype.getDefaultPP = function(req, res, next) {
  const PaymentProcessor = this.models.PaymentProcessor;

  PaymentProcessor
    .findOne({ user: req.user.id, default: true })
    .then((result) => res.status(200).send(result.toObject()))
    .catch((err) => res.status(500).send(err));
};

/**
 * Export definitions
 * @private
 */
PaymentProcessorsRouter.prototype._definitions = function() {
  return [
    ['POST', '/pp/add',
      this.authenticate,
      this.addPP
    ],
    ['POST','/pp/remove',
      this.authenticate,
      this.removePP
    ],
    ['GET', '/pp/default',
      this.authenticate,
      this.getDefaultPP
    ]
  ];
};

module.exports = PaymentProcessorsRouter;
