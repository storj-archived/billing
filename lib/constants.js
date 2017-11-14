/**
 * @module storj-bridge/constants
 */

'use strict';

const moment = require('moment');

/**
 * Adds X num of months from today to set expiration date on promo_amount
 * @param {number} numOfMonths
 */
function setPromoExpiration (value, unit) {
  return moment.utc().add(value, unit).toDate();
};

module.exports = {
  DEFAULT_FILE_TTL: '90d',
  PAYMENT_PROCESSORS: {
    STRIPE: 'stripe',
    BRAINTREE: 'braintree',
    HEROKU: 'heroku',
    COINPAYMENTS: 'coinpayments',
    DEFAULT: 'none'
  },
  STRIPE_MIN_CENTS: 1.0,
  STRIPE_PLAN_ID: 'premium',
  PROMO_CODE: {
    NEW_SIGNUP: 'new-signup',
    REFERRAL_RECIPIENT: 'referral-recipient',
    REFERRAL_SENDER: 'referral-sender',
    'PAID_THRESHOLD': 'paid-threshold'
  },
  PROMO_EXPIRES: {
    'DEFAULT': setPromoExpiration(1, 'year'),
    'NEW_SIGNUP': setPromoExpiration(3, 'months'),
    'REFERRAL_RECIPIENT': setPromoExpiration(3, 'months'),
    'REFERRAL_SENDER': setPromoExpiration(3, 'months'),
    'PAID_THRESHOLD': setPromoExpiration(1, 'months')
  },
  PROMO_AMOUNT: {
    'NEW_SIGNUP': 4.88,
    'REFERRAL_RECIPIENT': 9.75,
    'REFERRAL_SENDER': 9.75,
    'MIN_SPENT_REQUIREMENT': 10,
    'PAID_THRESHOLD': 167
  },
  REFERRAL_TYPES: {
    LINK: 'link',
    EMAIL: 'email'
  },
  CREDIT_TYPES: {
    AUTO: 'automatic',
    MANUAL: 'manual'
  },
  DEBIT_TYPES: {
    STORAGE: 'storage',
    BANDWIDTH: 'bandwidth',
    OTHER: 'adjustment'
  },
  GB: 1000000000,
  MS_TO_HOUR: 1000 * 60 * 60,
  STORAGE_DEBIT_TYPE: "storage",
  BANDWIDTH_DEBIT_TYPE: "bandwidth",
  LOG_LEVEL_NONE: 0,
  LOG_LEVEL_ERROR: 1,
  LOG_LEVEL_WARN: 2,
  LOG_LEVEL_INFO: 3,
  LOG_LEVEL_DEBUG: 4,
  ACCEPTED_CURRENCIES: [
    'storj',
    'btc',
    'eth'
  ],
  STORJ_FALLBACK_PRICE: 0.511
};
