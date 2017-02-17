'use strict';

const Router = require('./index');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const authenticate = middleware.authenticate;
const { CREDIT_TYPES, PROMO_CODE, STRIPE, PROMO_EXPIRES, PROMO_AMOUNT } = require('storj-service-storage-models/lib/constants');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');
const StorjMailer = require('storj-service-mailer');
const defaults = require('../../config.js').DEFAULTS;
const mailer = new StorjMailer(defaults.mailer);
const graphqlService = require('../graphql');

function ReferralsRouter(options) {
  if (!(this instanceof ReferralsRouter)) {
    return new ReferralsRouter(options);
  }
  Router.apply(this, arguments);
  this.models = this.storage.models;
}

inherits(ReferralsRouter, Router);

/**
 * Sends an email to all emails listed for user
 * @param req.body.marketing - marketing obj of current user
 * @param req.body.emailList - list of all emails current user is sending a
 *   referral email to
 */
ReferralsRouter.prototype.sendReferralEmail = function(req, res) {
  console.log('Made it to the right place')
  const self = this;
  const { Marketing, Referral } = self.models;
  const marketing = req.body.marketing;
  const emailList = req.body.emailList;
  const response = {
    failures: [],
    successes: []
  };
  const promiseArray = [];

  graphqlService.currentUserId.then((userId) => {

    // Create a promise for each email, and then push that promise to array
    emailList.forEach((email) => {
      const emailPromise = function() {
        return new Promise((resolve, reject) => {
          self
            ._sendEmail(userId, email, marketing)
            .then(() => Referral.create(marketing, email, 'email'))
            .then((referral) => resolve(referral))
            .catch((err) => {
              return reject({
              message: 'Failed to connect to mailer-service',
              error: err.message,
              email: email,
              marketing: marketing
              });
            });
        });
      }
      promiseArray.push(emailPromise());
    });

    // Call all the promises in promiseArray and push them to respective prop
    // on response object. Using promise.reflect() returns a success even if
    // there was an error. Allows every promise in array to be iterated over
    Promise
      .all(promiseArray.map((promise) => promise.reflect()))
      .each((inspection) => {
        if (inspection.isFulfilled()) {
          response.successes.push(inspection.value());
        } else {
          response.failures.push(inspection.reason());
        }
      })
      .then(() => res.status(200).send(response))
      .catch((err) => res.status(500).send(new errors.InternalError(err)));
  })
  .catch((err) => res.status(500).send(new errors.InternalError(err)));
};

ReferralsRouter.prototype._sendEmail = function(senderEmail, recipientEmail, marketing) {
  return new Promise((resolve, reject) => {
    mailer.dispatch(recipientEmail, 'referral', {
      url: 'https://app.storj.io/#/signup?referralLink=' + marketing.referralLink,
      senderEmail: senderEmail
    }, function(err) {
      if (err) {
        console.error('Error sendReferralEmail: ', err);
        return reject(err);
      }
      return resolve(true);
    });
  });
};

/**
 * Export definitions
 * @private
 */
ReferralsRouter.prototype._definitions = function () {
  return [
    ['POST', '/referrals/sendReferralEmail',
      rawbody,
      this.sendReferralEmail
    ]
  ];
};

module.exports = ReferralsRouter;
