'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
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
    console.log(`remove payment method args: ${JSON.stringify(args)}`);
    return graphqlService.models.PaymentProcessor.findOne({_id: args.paymentProcessorId})
        .then((paymentProcessor) => {
          console.log(`paymentProcessor: ${JSON.stringify(paymentProcessor)}`);
          return paymentProcessor.adapter.removePaymentMethod(args.paymentMethodId);
        })
        .catch((err) => {
          console.log(err.stack);
          throw err;
        });
  }
};

module.exports = removePaymentMethod;
