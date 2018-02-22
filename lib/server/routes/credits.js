'use strict';

const Router = require('./index');
const moment = require('moment');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
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
  this.authenticate = middleware.authenticate(options.storage);
  Object.assign(this, helperFactory(this.models));
}

inherits(CreditsRouter, Router);

CreditsRouter.prototype.handleSignups = function (req, res) {
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

    return res.status(200).send('Success');
  })
}

/**
 * Handles sign ups with referral links. Validates referral link, issues
 * sign up credit, and tracks that the referral recipient has been converted
 * @param {string} req.body.email - new user's email
 * @param {string} req.body.referralLink - referral link from location.query
 */
CreditsRouter.prototype.handleReferralSignup = function(req, res) {
  const self = this;
  const Marketing = self.models.Marketing;

  Marketing.isValidReferralLink(req.body.referralLink).then((marketing) => {
    marketing._id = marketing.id;
    self._noDuplicateCredit(req.body)
      .then(() => self._getReferral(req.body, marketing))
      .then((referral) => {
        self._issueReferralSignupCredit(req.body, referral)
          .then((credit) => self._convertReferralRecipient(referral, credit))
          // TODO: Send back amount of credit created so user knows it worked
          // res.status(200).send({ creditAmount: credit.promo_amount,
          // referralLink: referral.link })
          .then((referral) => res.status(200).send('Success'))
          .catch((err) => res.status(err.status).send(err));
      })
      .catch((err) => res.status(err.status).send(err))
  })
  .catch((err) => {
    if (err.message === 'Invalid referral link') {
      return res.status(200).send('Sign up successful, invalid referral link');
    }
    return res.status(err.status).send(err);
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
 * Verfies that there is only one referral.recipient type of credit. A user can
 * receive as many referral.sender credits, but can only ever be the recipient
 * of ONE referral.recipient credit, since you can only sign up once per user
 */
CreditsRouter.prototype._noDuplicateCredit = function(data) {
  const Credit = this.models.Credit;

  return new Promise((resolve, reject) => {
    Credit.find({
      user: data.email,
      promo_code: PROMO_CODE.REFERRAL_RECIPIENT
    }).then((credits) => {
      if (!credits.length) {
        return resolve(true);
      }
      return reject(new errors.BadRequestError(
        'Duplicate referral recipient credit'
      ));
    })
    .catch((err) => reject(new errors.InternalError(err.message)));
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
  return new Promise((resolve, reject) => {
    referral.convert_recipient_signup(credit)
      .then((referral) => {
        return resolve(referral);
      })
      .catch((err) => reject(errors.InternalError(err)));
  });
};

function handlePaymentFailure(res) {
  console.log('payment failed: ', res.locals.event.type);
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

    // TODO: refactor into adapter
    this.models.Credit.findOne({
      'data.invoice.id': invoice.id,
      'data.invoice.paid': false,
      'data.invoice.attempted': false,
      paid_amount: 0,
      invoiced_amount: {$gt: 0}
    })
      .then((credit) => {
        if (!credit) {
          const err = new Error(`Could not find credit with invoice id: `, invoice.id);
          console.error(err);
          return Promise.reject(err);
        }

        // TODO: refactor into adapter
        // NB: `credit.data.invoice` should have a positive `.total`
        //     as opposed to `credit.data.discountedInvocie`
        if (credit.invoiced_amount !== credit.data.invoice.total) {
          console.warn("Invoiced amount not equal to invoice subtotal.");
          console.warn("Expected: ", credit.invoiced_amount);
          console.warn("Received: ", invoice.total);
        }

        // TODO: refactor into adapter
        credit.paid_amount = credit.data.invoice.total;
        credit.paid = true;
        credit.data.confirmedInvoice = invoice;

        // TODO: is this necessary?
        credit.markModified('data');

        return credit.save();
      })
      .then((credit) => {
        console.log('Credit updated: %j', credit);
        return res.sendStatus(204)
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

CreditsRouter.prototype.getCredits = function(req, res, next) {
  const Credit = this.models.Credit;

  if (!req.query.startDate && !req.query.endDate) {
    return Credit.find({ user: req.user.id })
      .then((credits) => {
        const creditObjects = credits.map(credit => credit.toObject());
        res.status(200).send(creditObjects);
      })
      .catch((err) => next(new errors.InternalError(err.message)));
  }

  Credit.find({
    user: req.user.id,
    created: {
      $gte: req.query.startDate,
      $lt: req.query.endDate
    }
  }, function(err, credits) {
    if (err) {
      return next(new errors.InternalError(err.message));
    }
    res.status(200).send(credits.map(credit => credit.toObject()));
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
    ['GET', '/credits',
      this.authenticate,
      this.getCredits
    ],
    [
      'POST', '/credits/signups',
      rawbody,
      this.handleSignups
    ]
  ];
};

module.exports = CreditsRouter;
