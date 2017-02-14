'use strict';

const graphql = require('graphql');

const ReferralType = new graphql.GraphQLObjectType({
  name: 'Referral',
  fields: {
    sender: {
      type: new graphql.GraphQLObjectType({
        name: 'ReferralSender',
        fields: {
          id: { type: graphql.GraphQLString }
        }
      })
    },
    recipient: {
      type: new graphql.GraphQLObjectType({
        name: 'ReferralRecipient',
        fields: {
          id: { type: graphql.GraphQLString }
        }
      })
    },
    created: { type: graphql.GraphQLString },
    type: { type: graphql.GraphQLString }
  }
});

module.exports = ReferralType;
