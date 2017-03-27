'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorEnum = require('../types/payment-processor-enum');
const Promise = require('bluebird');

const addPaymentMethod = {
  type: paymentProcessorType,
  args: {
    name: {
      type: paymentProcessorEnum
    },
    data: {
      type: graphql.GraphQLString
    }
  },
  resolve: function(_, args) {
    return new Promise((resolve, reject) => {
      Promise.join(
        graphqlService.defaultPaymentProcessor,
        graphqlService.currentUser,
        function(defaultPaymentProcessor, user) {
          const data = JSON.parse(args.data);

          if (!defaultPaymentProcessor) {
          // NB: addPaymentProcessor also adds in the payment method
            return graphqlService
              .addPaymentProcessor(args.name, data)
              .then(() => _convertUser(user))
              .then(() => resolve())
              .catch((err) => reject({ error: err }));
          }

          if (defaultPaymentProcessor.paymentMethods.length > 1) {
            return reject(
              new Error('Multiple card support not available at this time.'
            ));
          }

          defaultPaymentProcessor
            .addPaymentMethod(data)
            .then(() => _convertUser(user))
            .then(() => resolve())
            .catch((err) => reject({ error: err }));
        }
      );
    });
  }
};

module.exports = addPaymentMethod;

function _convertUser(user) {
  return new Promise((resolve, reject) => {
    user.isFreeTier = false;
    user
      .save()
      .then((user) => resolve(user))
      .catch((err) => reject(err));
  });
}
