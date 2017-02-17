'use strict';

const graphql = require('graphql');
const graphqlService = require('../index');
const MarketingType = require('../types/marketing');
const moment = require('moment');

const MarketingQuery = {
  type: MarketingType,
  resolve: function() {
    console.log('MARKETING QUERY HIT');
    return graphqlService.currentUserId
      .then((userId) => {
        console.log('MARKETING TESTS: ', userId);
        const Marketing = graphqlService.models.Marketing
        return Marketing.findOne({ user: userId })
          .then((marketing) => {
            if (marketing) {
              console.log('MARKETING FOUND: ', marketing);
              return marketing;
            }

            return Marketing.create(userId, function(err, marketing) {
              if(err) console.log('Error creating marketing: ', err);
              console.log('marketing doc create: ', marketing)
              return marketing;
            })
          })
          .catch((err) => {
            console.log('Error fetching Marketing documents: ', err)
            return err;
          })
        // return graphqlService.models.Marketing.findOne({ user: userId });
      })
  }
};

module.exports = MarketingQuery;
