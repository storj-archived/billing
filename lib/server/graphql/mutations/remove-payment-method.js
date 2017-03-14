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
        return paymentProcessor.adapter.removePaymentMethod(args.paymentMethodId);
      })
      .then(() => {
        console.log('reached removePaymentMethod.then()')
        graphqlService.currentUser.then((user) => {
          console.log('REMOVE PAYMENT METHOD USER: %j', user);
          user.isFreeTier = true;
          console.log('isFreeTier should be true:', user.isFreeTier);
          console.log('removePaymentMethod user: %j', user);
          return user.save()
            .then((user) => {
              console.log('Remove payment method user after save: ', user);
            });
        })
      })
      .catch((err) => {
        throw err;
      });
  }
};

module.exports = removePaymentMethod;
