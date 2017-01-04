/**
 * @module storj-bridge/constants
 */

'use strict';

module.exports = {
  /** @constant {Number} DEFAULT_FILE_TTL - File renewal interval */
  DEFAULT_FILE_TTL: '90d',
  PAYMENT_PROCESSORS: {
    STRIPE: 'stripe',
    BRAINTREE: 'braintree',
    HEROKU: 'heroku'
  },
  STRIPE_PLAN_ID: 'premium',
  CREDIT_TYPES: {
    AUTO: 'automatic',
    MANUAL: 'manual'
  },
  DEBIT_TYPES: {
    AUDIT: 'audit',
    TRANSFER: 'transfer',
    OTHER: 'adjustment'
  },
  HEROKU_PUBLIC_KEY: null,
  LOG_LEVEL_NONE: 0,
  LOG_LEVEL_ERROR: 1,
  LOG_LEVEL_WARN: 2,
  LOG_LEVEL_INFO: 3,
  LOG_LEVEL_DEBUG: 4
};
