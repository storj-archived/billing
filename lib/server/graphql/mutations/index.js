'use strict';

const graphql = require('graphql');
const addPaymentMethod = require('./add-payment-method');
const removePaymentMethod = require('./remove-payment-method');

const rootMutation = new graphql.GraphQLObjectType({
  name: 'Mutation',
  fields: {
    addPaymentMethod,
    removePaymentMethod
  }
});

module.exports = rootMutation;
