'use strict';

const graphql = require('graphql');
const addPaymentMethod = require('./add-payment-method');
const removePaymentMethod = require('./remove-payment-method');
const sendReferralEmails = require('./send-referral-emails');
const issueSignupCredit= require('./issue-signup-credit');
const convertReferralRecipient = require('./convert-referral-recipient');

const rootMutation = new graphql.GraphQLObjectType({
  name: 'Mutation',
  fields: {
    addPaymentMethod,
    removePaymentMethod,
    sendReferralEmails,
    issueSignupCredit,
    convertReferralRecipient
  }
});

module.exports = rootMutation;
