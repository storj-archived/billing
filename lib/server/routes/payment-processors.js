'use strict';

const moment = require('moment');
const inherits = require('util').inherits;
const Router = require('./index');
const middleware = require('storj-service-middleware');
const errors = require('storj-service-error-types');

// TODO: duplicated from service-storge-models `PaymentProcessor`

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

};

PaymentProcessorsRouter.prototype.removePP = function(req, res, next) {

};

PaymentProcessorsRouter.prototype.getDefaultPP = function(req, res, next) {

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
    ]
    ['GET', '/pp',
      this.authenticate,
      this.getDefaultPP
    ]
  ];
};

module.exports = PaymentProcessorsRouter;
