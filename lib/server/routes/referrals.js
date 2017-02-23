'use strict';

const Router = require('./index');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const authenticate = middleware.authenticate;
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
  this.schema = graphqlService.bindSchema(this.models);
}

inherits(ReferralsRouter, Router);

/**
 * Sends an email to all emails listed for user
 * @param req.body.marketing - marketing obj of current user
 * @param req.body.emailList - list of all emails current user is sending a
 *   referral email to
 */
ReferralsRouter.prototype.sendReferralEmail = function(req, res) {
  const self = this;
  const { Marketing, Referral } = self.models;
  const marketing = req.body.marketing;
  const emailList = req.body.emailList;
  const response = {
    failures: [],
    successes: []
  };
  const promiseArray = [];
  // Create a promise for each email, and then push that promise to array
  emailList.forEach((email) => {
    const emailPromise = function() {
      return new Promise((resolve, reject) => {
        console.log('sending from: ', marketing.user);
        console.log('sending to: ', email);
        console.log('sending marketing: ', marketing);
        const user = marketing.user;
        self._isNotCurrentUser(email)
          .then(() => self._sendEmail(user, email, marketing))
          .then(() => self._createReferral(marketing, email))
          .then((referral) => {
            return resolve({
              message: 'Referral and email sent successfully',
              email,
              marketing
            });
          })
          .catch((err) => {
            return reject({
              message: err.message,
              email,
              marketing
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
};

ReferralsRouter.prototype._isNotCurrentUser = function(recipientEmail) {
  const { User } = this.models;
  return new Promise((resolve, reject) => {
    User.find({ _id: recipientEmail })
      .then((result) => {
        if (!result.length) {
          return resolve(true);
        }
        return reject(new errors.BadRequestError(
          'User has already been invited'
        ));
      })
      .catch((err) => reject(err));
  });
};

ReferralsRouter.prototype._sendEmail = function(senderEmail, recipientEmail, marketing) {
  return new Promise((resolve, reject) => {
    mailer.dispatch(recipientEmail, 'referral', {
      url: 'https://app.storj.io/#/signup?referralLink=' + marketing.referralLink,
      senderEmail: senderEmail
    }, function(err) {
      if (err) {
        console.error('Error sendReferralEmail: ', err);
        return reject(new errors.InternalError('Internal mailer error'));
      }
      return resolve(true);
    });
  });
};

ReferralsRouter.prototype._createReferral = function(marketing, email) {
  const { Referral } = this.models;
  return new Promise((resolve, reject) => {
    marketing._id = marketing.id;
    Referral.create(marketing, email, 'email')
      .then((referral) => resolve(referral))
      .catch((err) => reject(err));
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
