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
          if(user.defaultPaymentProcessor){
            if(user.defaultPaymentProcessor.paymentMethods > 1){
              throw new Error('Multiple card support not available at this time.');
            }


            return new Promise((resolve, reject) => {
              setTimeout(() => {
                user.defaultPaymentProcessor.addPaymentMethod(data)
                  .then(() => user.constructor.findOne({ _id: user._id }))
                  .then((user) => {
                    console.log('user constructor return: ', user.defaultPaymentProcessor.data.customer.sources.data);
                    return resolve(user.defaultPaymentProcessor);
                  })
              }, 3000)
            })
          }
          return user.addPaymentProcessor(args.name, data);
        })
        .catch((err) => {
          console.error(err);
          return {error: new Error(err)};
        });
  }
};

module.exports = addPaymentProcessor;
