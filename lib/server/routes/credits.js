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

function getBillingCycle(billingDate) {
  const today = new Date();
  const daysInMonth = (new Date(today.getFullYear(), (today.getMonth()), 0)).getDate();
  const startDayOfMonth = (billingDate > daysInMonth) ? daysInMonth : billingDate;
  const startDate = Date.parse(new Date(
    today.getFullYear(),
    (today.getMonth() - 1),
    startDayOfMonth
  ));
  const endDate = (moment(startDate).add('1', 'month').unix() * 1000);
  return {
    startDate: startDate,
    endDate: endDate
  };
};

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
  return;
}

CreditsRouter.prototype.handleReferralSignup = function(req, res) {
  const self = this;
  const Marketing = this.models.Marketing;

  Marketing.isValidReferralLink(req.body.referralLink)
    .then((marketing) => {
      self._issueSignupCredit(req.body, 'referral')
        .then((credit) => {
          self._convertReferralRecipient(credit, marketing, req.body)
            .then((referral) => res.status(200).send(referral))
            .catch((err) => res.status(500).send(err));
        })
        .catch((err) => {
          if (err.message === 'Invalid referral link') {
            return self._issueSignupCredit(req.body)
          }
        })
    })
}

CreditsRouter.prototype.handleSignups = function (req, res) {
  const self = this;
  const Marketing = this.models.Marketing;
  Marketing.create(req.body.email, function(err, marketing) {
    if (err) {
      return res.status(500).send(err);
    }

    if (req.body.referralLink) {
      return self.handleReferralSignup(req, res);
    }

    self._issueSignupCredit(req.body)
      .then((credit) => res.status(200).send(credit))
      .catch((err) => res.status(500).send(err));
  })
}

/**
 * anonymous function - description
 *
 * @param  {type} credit    description
 * @param  {type} marketing refers to sender marketing document, NOT recipient
 * @param  {type} data      description
 * @return {type}           description
 */
CreditsRouter.prototype._convertReferralRecipient = function (credit, marketing, data) {
  console.log('_convertReferralRecipient: ', credit, 'Marketing: ', marketing,
    'Link: ', data.referralLink, data.email);
  const Referral = this.models.Referral;

  return new Promise((resolve, reject) => {
    Referral
      .findOne({
        'sender.referralLink': data.referralLink,
        'recipient.email': data.email
      })
      .then((referral) => {
        console.log('REFERRAL', referral);
        if (referral) {
          console.log('MODIFYING REFERRAL; ', referral);
          return resolve(referral.convert_recipient_signup(credit));
        }
        console.log('creating new referral:', referral)
        Referral
          .create(marketing, data.email, 'link')
          .then((referral) => referral.convert_recipient_signup(credit))
          .then((referral) => resolve(referral))
      })
      .catch((err) => reject(errors.InternalError(err)))
  });
}

CreditsRouter.prototype._issueSignupCredit = function (data, userType) {
  const Credit = this.models.Credit;
  const type = userType === 'referral' ? 'REFERRAL_RECIPIENT' : 'NEW_SIGNUP';
  return new Promise((resolve, reject) => {
    const newCredit = new Credit({
      user: data.email,
      type: CREDIT_TYPES.AUTO,
      promo_code: PROMO_CODE[type],
      promo_amount: PROMO_AMOUNT[type],
      promo_expires: PROMO_EXPIRES[type]
    });

    console.log('issueSignupCredit Created: ', newCredit);
    newCredit
      .save()
      .then((credit) => resolve(credit))
      .catch((err) => reject(err));
  });
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
}

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
  const stripeAdapter = paymentProcessorAdapters[STRIPE];
  const invoice = res.locals.event.data.object;
  const customerId = invoice.customer;

  if (invoice.object === 'invoice' && invoice.attempted === 'false') {
    console.log("invoice.object should be invoice: ", invoice.object)
    console.log("invoice.attempted should be false: ", invoice.attempted);
    return res.sendStatus(400);
  }

  // TODO: refactor this to be payment processor agnostic!
  this.models.PaymentProcessor.findOne({
      'rawData.customer.id': customerId
    })
    .then((stripeProcessor) => {
      const billingCycle = getBillingCycle(stripeProcessor.billingDate);
      const params = {
        user: user._id,
        created: {
          $gte: moment(parseInt(billingCycle.startDate, 0)),
          $lte: moment(parseInt(billingCycle.endDate, 0))
        }
      };

      return [
        this.models.Debit.find(params),
        this.models.Credit.find(params),
        this.models.Credit.find({
          user: user._id
        }),
        user,
        billingCycle
      ];
    })
    .then((promises) => (Promise.all(promises)))
    .then((results) => {
      const debits = results[0];
      const credits = results[1];
      const allCredits = results[2];
      const user = results[3];
      const billingCycle = results[4];

      const balance = getBalance(credits, debits);
      const promoBalance = getPromoBalance(allCredits);

      const invoiceAmount = (balance - promoBalance < 0) ?
        0 : balance - promoBalance;

      const promoUsed = (promoBalance - balance > 0) ?
        balance : promoBalance;

      const totalAmount = (invoiceAmount < 0) ?
        0 : invoiceAmount

      const newCredit = new this.models.Credit({
        invoiced_amount: invoiceAmount,
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

      newCredit.save((err, credit) => {
        if (err) {
          throw new Error(err);
        }
      })
    })
    .catch((err) => {
      console.error(err);
      throw new Error(err);
    })

  res.sendStatus(201);
}

CreditsRouter.prototype.confirmCredit = function(req, res) {
  if(!invoice.paid){
    return res.status(202).json({'message':'Invoice has not been paid.'})
  }

  this.models.Credit.findOne({
    'data.invoice.id': invoice.id
  })
  .then((credit) => {
    if(credit.invoiced_amount !== invoice.subtotal){
      console.error("Invoiced amount not equal to invoice subtotal.");
      console.error("Expected: ", credit.invoiced_amount);
      console.error("Received: ", invoice.subtotal);
      return res.sendStatus(202);
    }

    if(!result){
      console.error("Could not find credit with invoice id: ", invoice.id);
      return res.sendStatus(202);
    }

    credit.paid_amount = invoice.subtotal;
    credit.paid = true;
    credit.data = {
      invoice: invoice
    };

    return credit.save();
  })
  .then((result) => {
    return res.sendStatus(204)
  })
  .catch((err) => {
    console.error("Error updating credit: ", err);
    return res.sendStatus(500);
  })


};

CreditsRouter.prototype.getReferralSenderCreditsByDate = function(req, res, next) {
  const Credit = this.models.credit;
  Credit.find({
    created: { $gte: req.periodStart, $lte: req.periodEnd }
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
