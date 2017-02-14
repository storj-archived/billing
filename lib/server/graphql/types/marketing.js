'use strict';

const graphql = require('graphql');

const MarketingType = new graphql.GraphQLObjectType({
  name: 'Marketing',
  fields: {
    id: { type: graphql.GraphQLString },
    user: { type: graphql.GraphQLString },
    created: { type: graphql.GraphQLString },
    referralLink: { type: graphql.GraphQLString }
  }
});

module.exports = MarketingType;
