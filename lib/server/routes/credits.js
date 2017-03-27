'use strict';

const Router = require('./index');
const moment = require('moment');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const authenticate = middleware.authenticate;
const {
  CREDIT_TYPES,
  PROMO_CODE,
  PROMO_EXPIRES,
  PROMO_AMOUNT
} = require('storj-service-storage-models/lib/constants');
const stripe = require('../vendor/stripe');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');
const helperFactory = require('./helpers/credits-helper');

function CreditsRouter(options) {
  if (!(this instanceof CreditsRouter)) {
    return new CreditsRouter(options);
  }
  Router.apply(this, arguments);
  this.models = options.storage.models;
  Object.assign(this, helperFactory(this.models));
}

inherits(CreditsRouter, Router);

CreditsRouter.prototype.handleSignups = function (req, res) {

  const self = this;
  const Marketing = this.models.Marketing;
  Marketing.create(req.body.email, function(err, marketing) {
    if (err) {
      return res.status(500).send(err);
    }
    console.log('CREATED MARKETING DOC: ', marketing);
    if (req.body.referralLink) {
      return self.handleReferralSignup(req, res);
    }

    return res.status(200).send('Success');
  })
}

CreditsRouter.prototype._issueRegularSignupCredit = function(data) {
  const Credit = this.models.Credit;

  return new Promise((resolve, reject) => {
    const newCredit = new Credit({
      user: data.email,
      type: CREDIT_TYPES.AUTO,
      promo_code: PROMO_CODE.NEW_SIGNUP,
      promo_amount: PROMO_AMOUNT.NEW_SIGNUP,
      promo_expires: PROMO_EXPIRES.NEW_SIGNUP
    });

    newCredit
      .save()
      .then((credit) => {
        return resolve(credit);
      })
      .catch((err) => {
        return reject(err);
      });
  });
};

/**
 * Used by `handleReferralSignup` to retrieve the referral doc related to the
 * referral link passed in. If the referral doc exists, then the referral type
 * has been previously generated and is of type 'email' (meaning some user sent
 * an email to this new user previously). If the referral doc does not exist,
 * then no referral email was sent prior to sign up, and type is of 'link'
 * @param {Object} data - req.body containing email and referralLink
 * @param {Object} marketing - marketing document belong to referral sender
 */
CreditsRouter.prototype._getReferral = function(data, marketing) {
  const Referral = this.models.Referral;
  return new Promise((resolve, reject) => {
    Referral
      .findOne({
        'sender.referralLink': data.referralLink,
        'recipient.email': data.email
      })
      .then((referral) => {
        if (referral) {
          return resolve(referral);
        }
        Referral
          .create(marketing, data.email, 'link')
          .then((referral) => {
            return resolve(referral)
          })
          .catch((err) => reject(errors.InternalError(err)));
      })
      .catch((err) => reject(errors.InternalError(err)))
  });
};

/**
 * Issues a referral recipient sign up credit
 * @param {Object} data - req.body with email and referralLink props
 * @param {Object} referral - referral doc
 */
CreditsRouter.prototype._issueReferralSignupCredit = function(data, referral) {
  const Credit = this.models.Credit;

  return new Promise((resolve, reject) => {

    const newCredit = new Credit({
      user: data.email,
      type: CREDIT_TYPES.AUTO,
      promo_code: PROMO_CODE.REFERRAL_RECIPIENT,
      promo_amount: PROMO_AMOUNT.REFERRAL_RECIPIENT,
      promo_expires: PROMO_EXPIRES.REFERRAL_RECIPIENT,
      promo_referral_id: referral.id
    });

    newCredit.save().then((credit) => {
      return resolve(credit);
    })
    .catch((err) => {
      return reject(err);
    });
  });
};

/**
 * Dates when a referral recipient was converted.
 *
 * @param {object} referral - instance of referral doc
 * @param {object} credit - referral recipient credit doc
 */
CreditsRouter.prototype._convertReferralRecipient = function(referral, credit) {
  console.log('_convertReferralRecipient')

  return new Promise((resolve, reject) => {
    referral.convert_recipient_signup(credit)
      .then((referral) => {
        return resolve(referral);
      })
      .catch((err) => reject(errors.InternalError(err)));
  });
};

function handlePaymentFailure(res) {
}

CreditsRouter.prototype.verify = function(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const eventId = req.body.id;
    stripe.events.retrieve(eventId, function(err, event) {
      if (err) {
        next(err);
      }
      res.locals.event = event;
      next(null);
    })
  } else {
    res.locals.event = req.body;
    next(null);
  }
};

CreditsRouter.prototype.checkType = function(type) {
  return function(req, res, next) {
    if (!type.test(res.locals.event.type)) {
      return res.sendStatus(400);
    }

    return next(null);
  }
};

CreditsRouter.prototype.handleCreateCredit = function(req, res) {
  // TODO: refactor this to be payment processor agnostic (or mount at /stripe)
  try {
    if (/invoice.payment_failure/.test(res.locals.event.type)) {
      handlePaymentFailure(res);
      return res.sendStatus(203);
    }

    let invoice = res.locals.event.data.object;
    const customerId = invoice.customer;

    if (invoice.object === 'invoice' && invoice.attempted === 'false') {
      return res.sendStatus(400);
    }

    // NB: total includes stripe discounts
    if (invoice.total <= 0) {
      /**
       * NB: stripe creates and pays (not necessarily in that order, apparently)
       *     an invoice upon subscription creation. Our default subscription
       *     has a plan which has an amount of $0.00 which is translated to that
       *     initial invoice's amount.
        */
      return res.sendStatus(200);
    }

    /**
     * 1) verify invoice amount?
     * 2) create stripe invoice item with negative amount = spendable credit/promo <= invoiced amount
     * 4) fetch updated stripe invoice
     * 3) create credit w/ invoiced_amount = updated stripe invoice amount
     */
    this.models.PaymentProcessor.findByForeignId(customerId, 'stripe')
      .then(paymentProcessor => [invoice, paymentProcessor])
      .then(this.getUserCreditsAndDebits)
      .then(this.calculateAndApplyPromoCredit)
      .then(this.createAndApplyFreeThresholdCredit)
      .then(this.createCredit)
      .catch((err) => {
        throw new Error(err);
      });
  } catch (err) {
    return res.sendStatus(500);
  }

  return res.sendStatus(201);
};

CreditsRouter.prototype.handleConfirmCredit = function(req, res) {
  try {
    const invoice = res.locals.event.data.object;

    if (!invoice.paid) {
      return res.status(202).json({ 'message': 'Invoice has not been paid.' })
    }

    this.models.Credit.findOne({
      'rawdata.0.data.invoice.id': invoice.id
    })
      .then((credit) => {
        if (credit.invoiced_amount !== invoice.total) {
          console.warn("Invoiced amount not equal to invoice subtotal.");
          console.warn("Expected: ", credit.invoiced_amount);
          console.warn("Received: ", invoice.total);
        }

        if (!credit) {
          res.sendStatus(202);
          return Promise.resolve({});
        }

        // TODO: find a better way!!
        credit.paid_amount = credit.invoiced_amount;
        credit.paid = true;
        credit.data = {
          invoice
        };

        // TODO: is this necessary?
        credit.markModified('data');

        return credit.save();
      })
      .then((credit) => {
        return res.sendStatus(204)
      })
      .catch((err) => {
        /**
         * NB: ignore invoices with total <= 0 because we don't create credits
         *     for those invoices starting with total <= 0 (e.g. initial
         *     subscription invoice for $0.00)
         */
        if (invoice.total <= 0) {
          return res.sendStatus(200);
        }

        throw err;
      })
      .catch((err) => {
        return res.sendStatus(500);
      })
  } catch (err) {
    return res.sendStatus(500);
  }
};

CreditsRouter.prototype.getReferralSenderCreditsByDate = function(req, res, next) {
  const Credit = this.models.credit;
  Credit.find({
    created: { $gte: req.periodStart, $lt: req.periodEnd }
  }, function(err, credits) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }
    res.status(200).send(credits.map(credit => credit.toObject()))
  })
};

/**
 * Export definitions
 * @private
 */
CreditsRouter.prototype._definitions = function() {
  return [
    ['POST', '/credits',
      rawbody,
      this.verify,
      this.checkType(/^invoice.created$/),
      this.handleCreateCredit
    ],
    ['POST', '/credits/confirm',
      rawbody,
      this.verify,
      this.checkType(/^invoice.payment_(succeeded|failed)$/),
      this.handleConfirmCredit
    ],
    ['GET',
      '/credits/referral/:periodStart/:periodEnd',
      authenticate,
      this.getReferralSenderCreditsByDate
    ],
    [
      'POST', '/credits/signups',
      rawbody,
      this.handleSignups
    ]
  ];
};

module.exports = CreditsRouter;
