'use strict';

const graphql = require('graphql');

const ServerMessageType = new graphql.GraphQLObjectType({
  name: 'ServerMessage',
  fields: {
    message: { type: graphql.GraphQLString },
    error: { type: graphql.GraphQLString }
  }
});

module.exports = ServerMessageType;
