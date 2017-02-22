'use strict';

const Router = require('./index');
const moment = require('moment');
const inherits = require('util').inherits;
const middleware = require('storj-service-middleware');
const rawbody = middleware.rawbody;
const log = require('../../logger');
const authenticate = middleware.authenticate;
const { CREDIT_TYPES, PROMO_CODE, STRIPE, PROMO_EXPIRES, PROMO_AMOUNT } = require('storj-service-storage-models/lib/constants');
const paymentProcessorAdapters = require('storj-service-storage-models/lib/models/payment-processor-adapters');
const stripe = require('../vendor/stripe');
const errors = require('storj-service-error-types');
const Promise = require('bluebird');

// TODO: Refactor all stripe-related endpoints into a single endpoint
// to remain payment processor agnostic.

/**
 * Handles endpoints for all user related operations
 */
function CreditsRouter(options) {
  if (!(this instanceof CreditsRouter)) {
    return new CreditsRouter(options);
  }
  this.models = options.storage.models;
  Router.apply(this, arguments);
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
  console.log('data', data, 'marketing' , marketing)
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
}

function getBalance(credits, debits) {
  const sumCredits = (total, item) => {
    return total + item.paid_amount;
  };

  const sumDebits = (total, item) => {
    return total + item.amount;
  };

  const creditSum = credits.reduce(sumCredits, 0);
  const debitSum = debits.reduce(sumDebits, 0);
  const balance = debitSum - creditSum;

  return balance;
}

function getPromoBalance(credits) {
  return credits.reduce((total, item) => {
    return total + item.promo_amount;
  }, 0);
}

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

    if(type.test(res.locals.event.type)) {
      handlePaymentFailure(res);
      return res.sendStatus(203);
    }

    return next(null);
  }
};

CreditsRouter.prototype.createCredit = function(req, res) {
  try {
    const invoice = res.locals.event.data.object;
    const customerId = invoice.customer;

    if (invoice.object === 'invoice' && invoice.attempted === 'false') {
      console.log("invoice.object should be invoice: ", invoice.object);
      console.log("invoice.attempted should be false: ", invoice.attempted);
      return res.sendStatus(400);
    }

    // TODO: refactor this to be payment processor agnostic!
    this.models.PaymentProcessor.findOne({
      'rawData.0.customer.id': customerId
    })
      .then((stripeProcessor) => {
        const billingCycle = stripeProcessor.currentBillingPeriod;
        const params = {
          user: user._id,
          created: {
            $gte: moment(parseInt(billingCycle.startDate, 0)),
            $lt: moment(parseInt(billingCycle.endDate, 0))
          }
        };

        return [
          this.models.Debit.find(params),
          this.models.Credit.find(params),
          this.models.Credit.find({
            user: user._id
          }),
          user
        ];
      })
      .then((promises) => (Promise.all(promises)))
      .then((results) => {
        const debits = results[0];
        const credits = results[1];
        const allCredits = results[2];
        const user = results[3];

        const balance = getBalance(credits, debits);
        const promoBalance = getPromoBalance(allCredits);

        const invoiceAmount = (balance - promoBalance < 0) ?
          0 : balance - promoBalance;

        const promoUsed = (promoBalance - balance > 0) ?
          balance : promoBalance;

        const totalAmount = (invoiceAmount < 0) ?
          0 : invoiceAmount;

        const newCredit = new this.models.Credit({
          invoiced_amount: totalAmount,
          paid_amount: 0,
          paid: false,
          promo_amount: promoUsed,
          user: user._id,
          payment_processor: STRIPE,
          type: CREDIT_TYPES.AUTO,
          data: {
            invoice: invoice
          }
        });

        // TODO: is this necessary?
        newCredit.markModified('data');

        newCredit.save((err, credit) => {
          if (err) {
            throw new Error(err);
          }
        })
      })
      .catch((err) => {
        console.error(err);
        throw new Error(err);
      });
  } catch (err) {
    console.error('Error caught in `routes/credit#createCredit`: %j', err);
    return res.sendStatus(500);
  }

  return res.sendStatus(201);
};

CreditsRouter.prototype.confirmCredit = function(req, res) {
  try {
    const invoice = res.locals.event.data.object;

    if (!invoice.paid) {
      return res.status(202).json({'message': 'Invoice has not been paid.'})
    }

    this.models.Credit.findOne({
      'data.invoice.id': invoice.id
    })
      .then((credit) => {
        if (credit.invoiced_amount !== invoice.subtotal) {
          console.error("Invoiced amount not equal to invoice subtotal.");
          console.error("Expected: ", credit.invoiced_amount);
          console.error("Received: ", invoice.subtotal);
          return res.sendStatus(202);
        }

        if (!credit) {
          console.error("Could not find credit with invoice id: ", invoice.id);
          return res.sendStatus(202);
        }

        credit.paid_amount = invoice.subtotal;
        credit.paid = true;
        credit.data = {
          invoice: invoice
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
      this.createCredit
    ],
    ['POST', '/credits/confirm',
      rawbody,
      this.verify,
      this.checkType(/^invoice.payment_(succeeded|failed)$/),
      this.confirmCredit
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
