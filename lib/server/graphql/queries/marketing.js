'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const MarketingType = require('../types/marketing');
const moment = require('moment');

const MarketingQuery = {
  type: MarketingType,
  resolve: function() {
    return graphqlService.currentUserId
      .then((userId) => {
        return graphqlService.models.Marketing.findOne({ user: userId });
      })
  }
};

module.exports = MarketingQuery;
