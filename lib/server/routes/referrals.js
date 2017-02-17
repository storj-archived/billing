'use strict';

const Router = require('./index');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const authenticate = middleware.authenticate;
const { CREDIT_TYPES, PROMO_CODE, STRIPE, PROMO_EXPIRES, PROMO_AMOUNT } = require('storj-service-storage-models/lib/constants');
const stripe = require('../vendor/stripe');
const errors = require('storj-service-error-types');

function ReferralsRouter(options) {
  if (!(this instanceof ReferralsRouter)) {
    return new ReferralsRouter(options);
  }
  this.models = options.storage.models;
  Router.apply(this, arguments);
}

inherits(ReferralsRouter, Router);

ReferralsRouter.prototype.sendReferralEmail = function(req, res) {

}

ReferralsRouter.prototype._definitions = function () {
 return [
  ['POST', '/referrals/sendReferralEmail',
    this.verify,
    rawbody,
    this.createReferralCredit
  ]
 ]
}
