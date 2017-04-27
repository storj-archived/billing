'use strict';
const helper = {};
const { CREDIT_TYPES, PROMO_CODE, PROMO_AMOUNT } = require('storj-service-storage-models/lib/constants');
let models;

/**
 * Look
 * @param results {Array}:
 *          0: invoice {Object} - (payment processor agnostic)
 *          1: paymentProcessor {PaymentProcessor}
 * @return {Promise}
 */
helper.getUserCreditsAndDebits =
  function getUserCreditsAndDebits([invoice, paymentProcessor]) {
    return Promise.all([
      Promise.resolve(invoice),
      Promise.resolve(paymentProcessor),
      models.Debit.find({
        user: paymentProcessor.user
      }),
      models.Credit.find({
        user: paymentProcessor.user
      })
    ]);
  };

/**
 * Lookup debits and credits for current user
 * @param results {Array}:
 *   0 {Object} - invoice
 *   1 {PaymentProcessor} - user's payment processor
 *   2 {Array<Debit>} - all user's debits
 *   3 {Array<Credit>} - all user's credits
 * @return {Promise}
 */
helper.calculateAndApplyPromoCredit =
  function calculateAndApplyPromoCredit(results) {
    // NB: invoice is a payment processor agnostic term
    const [invoice, paymentProcessor, debits, credits] = results;
    const finiteTotal = Number.isFinite(invoice.total);
    const { invoicedBalance, promoBalance } = getBalances(credits, debits);
    let promo_amount;
    let invoiced_amount;

    if (invoice.total <= 0) {
      console.warn('WARN: Stripe invoice.total <= 0 -- creating empty credit!');
      return Promise.resolve({
        invoice,
        paymentProcessor,
        invoiced_amount: 0,
        // NB: -------v guaranteed `undefined`
        promo_amount: (undef => undef)()
      })
    }

    if (promoBalance >= invoice.total) {
      // NB: promo_amount is negative
      promo_amount = finiteTotal && (invoice.total > 0) ?
        // NB: ----------v guaranteed `undefined`
        -invoice.total : (undef => undef)();
      invoiced_amount = 0;
      // TODO: should we do this?:  `creditParams.paid = true;`
    } else {
      promo_amount = -promoBalance;
      invoiced_amount = invoice.total - promoBalance;
    }

    const finitePromo = Number.isFinite(promo_amount);

    if (!finitePromo || promo_amount <= 0) {
      return Promise.resolve({
        invoice,
        paymentProcessor,
        invoiced_amount,
        // NB: -------v guaranteed `undefined`
        promo_amount: (undef => undef)()
      });
    }

    return paymentProcessor.adapter.applyCredit(promo_amount, invoice)
      .then((invoice) => {
        return {
          invoice,
          paymentProcessor,
          invoiced_amount,
          promo_amount
        }
      });
  };

/**
 * Add discount for free threshold to stripe
 * @param results {Object}:
 *   paymentProcessor {PaymentProcessor} - user's payment processor
 *
 * @return {Promise}
 */
helper.createAndApplyFreeThresholdCredit =
  function createAndApplyFreeThresholdCredit(results) {
    /**
     * NB: this route is expected to be called once per month!
     * TODO: add monitoring to ensure proper accreditation
     */
    const { invoice, paymentProcessor } = results;

    return paymentProcessor.adapter.applyCredit(
      -PROMO_AMOUNT.FREE_THRESHOLD,
      invoice,
      'Storj.io free threshold promo/credit applied'
    )
      .then((discountedInvoice) => {
        const promoExpirationMoment = paymentProcessor
          .nextBillingPeriod
          .endMoment;

        return helper.createCredit({
          invoice,
          discountedInvoice,
          paymentProcessor,
          type: CREDIT_TYPES.AUTO,
          promo_code: PROMO_CODE.FREE_THRESHOLD,
          promo_amount: PROMO_AMOUNT.FREE_THRESHOLD,
          promo_expires: promoExpirationMoment.valueOf()
        })
          .then(() => {
            delete results.invoice;
            return Object.assign({}, results, { invoice });
          });
      });
  };

/**
 * Create new storj credit document
 * @param results {Object}:
 *   invoice {Object}
 *   invoiced_amount {Integer}
 *   promo_amount {Integer}
 *   promo_code {String}
 *   promo_expires {Integer} - timestamp
 *   paymentProcessor {Object}:
 *     user {User}
 */
helper.createCredit = function createCredit({
  invoice,
  discountedInvoice,
  invoiced_amount,
  promo_amount,
  promo_code,
  promo_expires,
  paymentProcessor: {
    user,
    name: payment_processor
  }
}, opts) {
  const creditFields = Object.assign({
    type: CREDIT_TYPES.AUTO,
    data: {invoice, discountedInvoice},
    payment_processor,
    invoiced_amount,
    promo_amount,
    promo_code,
    promo_expires,
    user
  }, opts);

  return models.Credit.create(creditFields);
};

function getBalances(credits, debits) {
  const finiteSum = (array, field) => {
    return array.reduce((acc, item) => {
      const value = item[field];
      const finiteValue = Number.isFinite(value);
      return acc + finiteValue ? value : 0;
    }, 0)
  };

  const creditSum = finiteSum(credits, 'invoiced_amount');
  const debitSum = finiteSum(debits, 'amount');
  const promoBalance = finiteSum(credits, 'promo_amount');
  const invoicedBalance = debitSum - creditSum;


  return {
    invoicedBalance,
    promoBalance
  }
}

module.exports = function(_models) {
  models = _models;
  return helper;
};
