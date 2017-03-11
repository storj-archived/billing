'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const { PaymentProcessor } = graphqlService.models;
const paymentProcessorType = require('../types/payment-processor');
const stripe = require('../../vendor/stripe');
const STRIPE = require('../../../constants').PAYMENT_PROCESSORS.STRIPE;

// TODO: rename method to `removePaymentMethod` and replace implementation
//   with payment-processor-agnostic code
const removePaymentMethod = {
  type: paymentProcessorType,
  args: {
    paymentProcessorId: {type: graphql.GraphQLString},
    paymentMethodId: {type: graphql.GraphQLString}
  },
  resolve: function(_, args) {
    return PaymentProcessor.findOne({_id: args.paymentProcessorId})
      .then((paymentProcessor) => {
        if (paymentProcessor.paymentMethods.length > 0) {
          console.log('Attempting to removePaymentMethod');
          paymentProcessor.adapter
          .removePaymentMethod(args.paymentMethodId)
          .then((deleted) => deleted);
        } else {
          console.log('No payment methods to remove');
          return `No payment processor with ${args.paymentProcessorId} id`;
        }
      })
      .catch((err) => {
        throw err;
      });
  }
};

module.exports = removePaymentMethod;
