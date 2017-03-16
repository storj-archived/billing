'use strict';

const Router = require('./index');
const moment = require('moment');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const authenticate = middleware.authenticate;
const { CREDIT_TYPES, PROMO_CODE, PROMO_EXPIRES, PROMO_AMOUNT } = require('storj-service-storage-models/lib/constants');
const stripe = require('../vendor/stripe');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');
const helperFactory = require('./helpers/credits-helper');

// TODO: Refactor all stripe-related endpoints into a single endpoint
// to remain payment processor agnostic.

/**
 * Handles endpoints for all user related operations
 */
function CreditsRouter(options) {
  if (!(this instanceof CreditsRouter)) {
    return new CreditsRouter(options);
  }
  Router.apply(this, arguments);
  this.models = options.storage.models;
  Object.assign(this, helperFactory(this.models));
}

inherits(CreditsRouter, Router);


CreditsRouter.prototype.handleReferralSignup = function(req, res) {
  const self = this;
  const Marketing = self.models.Marketing;

  console.log('HIT: handleReferralSignup', req.body);

  Marketing.isValidReferralLink(req.body.referralLink).then((marketing) => {
      console.log('VALID MARKETING DOC: ', marketing)
      marketing._id = marketing.id;
    self._getReferral(req.body, marketing)
      .then((referral) => {
        self._issueReferralSignupCredit(req.body, referral)
          .then((credit) => self._convertReferralRecipient(referral, credit))
          .then((referral) => res.status(200).send(referral))
          .catch((err) => res.status(500).send(err));
      })
      .catch((err) => res.status(500).send(err))
  })
  .catch((err) => {
    if (err.message === 'Invalid referral link') {
      return self.handleRegularSignup(req, res);
    }
    res.status(500).send(err);
  });
};

CreditsRouter.prototype.handleRegularSignup = function(req, res) {
  console.log('HIT: handleRegularSignup for', req.body);
  const self = this;
  self._issueRegularSignupCredit(req.body)
    .then((credit) => res.status(200).send(credit))
    .catch((err) => res.status(500).send(err));
};

CreditsRouter.prototype.handleSignups = function (req, res) {
  console.log('handlingSignup: ', req.body);

  const self = this;
  const Marketing = this.models.Marketing;
  Marketing.create(req.body.email, function(err, marketing) {
    if (err) {
      console.log('Error creating signup marketing: ', err);
      return res.status(500).send(err);
    }

    if (req.body.referralLink) {
      return self.handleReferralSignup(req, res);
    }

    return self.handleRegularSignup(req, res);
  })
}


CreditsRouter.prototype._issueRegularSignupCredit = function(data) {
  console.log('_issueRegularSignupCredit data:', data)
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
        console.log('REGULAR USER CREDIT CREATED:', credit);
        return resolve(credit);
      })
      .catch((err) => {
        console.log('Error with creating regular sign up credit', err);
        return reject(err);
      });
  });
};

CreditsRouter.prototype._getReferral = function(data, marketing) {
  const Referral = this.models.Referral;
  console.log('data', data, 'marketing', marketing)
  return new Promise((resolve, reject) => {
    Referral
      .findOne({
        'sender.referralLink': data.referralLink,
        'recipient.email': data.email
      })
      .then((referral) => {
        if (referral) {
          console.log('GOT EXISTING REFERRAL: ', referral);
          return resolve(referral);
        }
        console.log('CREATING NEW REFERRAL...');
        Referral
          .create(marketing, data.email, 'link')
          .then((referral) => {
            console.log('NEW REFERRAL CREATED: ', referral)
            return resolve(referral)
          })
          .catch((err) => reject(errors.InternalError(err)));
      })
      .catch((err) => reject(errors.InternalError(err)))
  });
};

CreditsRouter.prototype._issueReferralSignupCredit = function(data, referral) {
  const Credit = this.models.Credit;

  return new Promise((resolve, reject) => {
    console.log('_issueReferralSignupCredit', data, referral.id);

    const newCredit = new Credit({
      user: data.email,
      type: CREDIT_TYPES.AUTO,
      promo_code: PROMO_CODE.REFERRAL_RECIPIENT,
      promo_amount: PROMO_AMOUNT.REFERRAL_RECIPIENT,
      promo_expires: PROMO_EXPIRES.REFERRAL_RECIPIENT,
      promo_referral_id: referral.id
    });

    newCredit.save().then((credit) => {
      console.log('REFEERRAL SIGNUP CREDIT CREATED: ', credit);
      return resolve(credit);
    })
    .catch((err) => {
      console.log('ERROR _issueReferralSignupCredit', err);
      return reject(err);
    });
  });
};

/**
 * anonymous function - description
 *
 * @param  {type} credit    description
 * @param  {type} marketing refers to sender marketing document, NOT recipient
 * @param  {type} data      description
 * @return {type}           description
 */
CreditsRouter.prototype._convertReferralRecipient = function(referral, credit) {

  console.log('_convertReferralRecipient')
  const Referral = this.models.Referral;

  return new Promise((resolve, reject) => {
    referral.convert_recipient_signup(credit)
      .then((referral) => {
        console.log('CONVERTED REFERRAL SIGNUP: ', referral)
        return resolve(referral);
      })
      .catch((err) => reject(errors.InternalError(err)));
  });
};

function handlePaymentFailure(res) {
  console.log("payment failed: ", res.locals.event.type);
}

CreditsRouter.prototype.verify = function(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const eventId = req.body.id;
    stripe.events.retrieve(eventId, function(err, event) {
      if (err) {
        console.error('error verifying stripe event');
        next(err);
      }
      res.locals.event = event;
      next(null);
    })
  } else {
    res.locals.event = req.body;
    // NB: for manual testing only, need to remove
    // res.locals.event.data.object.customer = 'cus_97ADNC3zbcPQkR';
    next(null);
  }
};

CreditsRouter.prototype.checkType = function(type) {
  return function(req, res, next) {
    if (!type.test(res.locals.event.type)) {
      console.error("Expected event type to match: ", type);
      console.error("Received: ", res.locals.event.type);
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
      console.error("Error in CreditsRouter#createCredit: invoice.object should be invoice: ", invoice.object);
      console.error("Error in CreditsRouter#createCredit: invoice.attempted should be false: ", invoice.attempted);
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
      console.warn(`Warning from CreditsRouter#createCredit: invoice.total <= 0; invoice: ${invoice}`);
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
        console.error(err);
        throw new Error(err);
      });
  } catch (err) {
    console.error('Error caught in `CreditsRouter#createCredit`:', err);
    return res.sendStatus(500);
  }

  return res.sendStatus(201);
};

CreditsRouter.prototype.handleConfirmCredit = function(req, res) {
  try {
    const invoice = res.locals.event.data.object;

    if (!invoice.paid) {
      console.error('Error in CreditsRouter#confirmCredit: invoice has ' +
        'not been paid: %j', invoice);
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
          console.error("Could not find credit with invoice id: ", invoice.id);
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
        console.log('Credit updated: %j', credit);
        return res.sendStatus(204)
      })
      .catch((err) => {
        /**
         * NB: ignore invoices with total <= 0 because we don't create credits
         *     for those invoices starting with total <= 0 (e.g. initial
         *     subscription invoice for $0.00)
         */
        if (invoice.total <= 0) {
          console.warn(`Warning from CreditsRouter#createCredit: ignoring credit ` +
            `update for invoice with total <= 0: ${invoice}`);
          return res.sendStatus(200);
        }

        throw err;
      })
      .catch((err) => {
        console.error("Error updating credit: ", err);
        return res.sendStatus(500);
      })
  } catch (err) {
    console.error('Error caught in `routes/credit#confirmCredit`: %j', err);
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
