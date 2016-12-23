'use strict';

const axios = require('axio');
const billingUrl = process.env.BILLING_URL || 'localhost:3000';

exports.postDebit = function(debit) {
  return axios.post(billingUrl, debit);
};

