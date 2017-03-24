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
    return new Promise((resolve, reject) => {
      PaymentProcessor.findOne({_id: args.paymentProcessorId})
        .then((paymentProcessor) => {
          if (paymentProcessor.paymentMethods.length <= 0) {
            console.log('No payment methods to remove');
            return resolve(
              `No payment processor with ${args.paymentProcessorId} id`
            );
          }
          console.log('Attempting to removePaymentMethod');
          paymentProcessor.adapter
            .removePaymentMethod(args.paymentMethodId)
            .then(() => {
              graphqlService.currentUser.then((user) => {
                user.isFreeTier = true;
                console.log('user should be freeTier: %j', user.isFreeTier);
                user
                  .save()
                  .then((user) => resolve(user))
                  .catch((err) => reject(err));
              })
            })
            .catch((err) => reject(err));
        });
    });
  }
};

module.exports = removePaymentMethod;
