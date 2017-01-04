'use strict';

const axios = require('axios');
const billingUrl = process.env.BILLING_URL || 'localhost:3000';

exports.postDebit = function(debit) {
  console.log('Debit: %j', debit);
  return axios.post(billingUrl, debit);
};

