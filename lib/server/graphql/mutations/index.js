'use strict';

const graphql = require('graphql');
const addPaymentMethod = require('./add-payment-method');
const removePaymentMethod = require('./remove-payment-method');
const sendReferralEmails = require('./send-referral-emails');

const rootMutation = new graphql.GraphQLObjectType({
  name: 'Mutation',
  fields: {
    addPaymentMethod: addPaymentMethod,
    removePaymentMethod: removePaymentMethod,
    sendReferralEmails: sendReferralEmails
  }
});

module.exports = rootMutation;
