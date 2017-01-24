'use strict';

const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorAdapters = require('storj-service-storage-models/lib/models/payment-processor-adapters');

const paymentProcessorQuery = {
  type: paymentProcessorType,
  resolve: function(user, args) {
    return graphqlService.defaultPaymentProcessor;
  }
};

module.exports = paymentProcessorQuery;
