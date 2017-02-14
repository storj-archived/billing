'use strict';

const Router = require('./index');
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const errors = require('storj-service-error-types');
const inherits = require('util').inherits;

function ReferralsRouter(options) {
  if (!(this instanceof ReferralsRouter)) {
    return new ReferralsRouter(options);
  }

  Router.apply(this, arguments);

  this.models = options.storage.models;

  // this._verify = authenticate(this.storage);
}

inherits(ReferralsRouter, Router);

ReferralsRouter.prototype.createReferralCredit = function(req, res) {
  const User = this.models.User;
  const Credit = this.models.Credit;

  const signupEmail = req.body.email;
  const referralLink = req.body.referralLink;

  console.log('createReferralCredit hit');
}

ReferralsRouter.prototype._definitions = function () {
 return [
   ['POST', '/referral', rawbody, this.createReferralCredit]
 ]
}
