'use strict';

const graphql = require('graphql');
const creditsQuery = require('./credits');
const debitsQuery = require('./debits');
const marketingQuery = require('./marketing');
const checkReferralLinkQuery = require('./check-referral-link');
const getReferralQuery = require('./get-referral');
const paymentProcessorQuery = require('./payment-processor');

const rootQuery = new graphql.GraphQLObjectType({
  name: 'Query',
  fields: {
    credits: creditsQuery,
    debits: debitsQuery,
    paymentProcessor: paymentProcessorQuery,
    marketing: marketingQuery,
    checkReferralLink: checkReferralLinkQuery,
    getReferral: getReferralQuery
  }
});

module.exports = rootQuery;
