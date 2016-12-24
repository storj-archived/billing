'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const paymentProcessorType = require('../types/payment-processor');
const paymentProcessorEnum = require('../types/payment-processor-enum');

const addPaymentProcessor = {
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
    return graphqlService.currentUser
        .then((user) => {
          const data = JSON.parse(args.data);
          console.log('graphql add payment processor user: ', user);
          return user.addPaymentProcessor(args.name, data);
        })
        .catch((err) => {
          console.error(err);
          return {error: new Error(err)};
        })
        ;
  }
};

module.exports = addPaymentProcessor;
