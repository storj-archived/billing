'use strict';
const { CREDIT_TYPES, PROMO_CODE, PROMO_AMOUNT } = require('storj-service-storage-models/lib/constants');

/**
 * Look
 * @param paymentProcessor
 * @return {Promise}
 */
exports.getUserCreditsAndDebits =
  function getUserCreditsAndDebits(paymentProcessor) {
    return Promise.all([
      Promise.resolve(invoice),
      this.models.Debit.find({
        user: paymentProcessor.user
      }),
      this.models.Credit.find({
        user: paymentProcessor.user
      }),
      Promise.resolve(paymentProcessor)
    ]);
  };

/**
 * Lookup debits and credits for current user
 * @param results {Array}:
 *   0 {Object} - invoice
 *   1 {Array<Debit>} - all user's debits
 *   2 {Array<Credit>} - all user's credits
 *   3 {PaymentProcessor} - user's payment processor
 * @return {Promise}
 */
exports.calculateAndApplyPromoCredit =
  function calculateAndApplyPromoCredit(results) {
    // NB: invoice is a payment processor agnostic term
    let invoice = results.shift();
    const [debits, credits, paymentProcessor] = results;
    const { invoicedBalance, promoBalance } = getBalances(credits, debits);
    let promo_amount;
    let invoiced_amount;

    if (promoBalance >= invoice.total) {
      // NB: promo_amount is negative
      promo_amount = -invoice.total;
      invoiced_amount = 0;
      // TODO: should we do this?:  `creditParams.paid = true;`
    } else {
      promo_amount = -promoBalance;
      invoiced_amount = (invoice.total - promoBalance);
    }

    if (promoBalance <= 0) {
      return Promise.resolve({
        invoice,
        paymentProcessor,
        invoiced_amount,
        promo_amount: undefined
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
exports.createAndApplyFreeThresholdCredit =
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
      .then((invoice) => {
        const promoExpirationMoment = paymentProcessor
          .nextBillingPeriod
          .endMoment;

        return createCredit({
          invoice,
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
exports.handleCreateCredit = function createCredit({
  invoice,
  invoiced_amount,
  promo_amount,
  promo_code,
  promo_expires,
  paymentProcessor: {
    user,
    name: paymentProcessor
  }
}, opts) {
  let data;
  if (typeOf(invoice) !== 'undefined') {
    data = { invoice };
  }

  const creditFields = Object.assign({
    type: CREDIT_TYPES.AUTO,
    data,
    paymentProcessor,
    invoiced_amount,
    promo_amount,
    promo_code,
    promo_expires,
    user
  }, opts);

  return this.models.Credit.create(creditFields);
};

function getBalances(credits, debits) {
  const sumCredits = (total, item) => {
    return total + item.invoiced_amount;
  };

  const sumDebits = (total, item) => {
    return total + item.amount;
  };

  const creditSum = credits.reduce(sumCredits, 0);
  const debitSum = debits.reduce(sumDebits, 0);
  const invoicedBalance = debitSum - creditSum;

  const promoBalance = credits.reduce((total, item) => {
    return total + item.promo_amount;
  }, 0);

  return {
    invoicedBalance,
    promoBalance
  }
}
