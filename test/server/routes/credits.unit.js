const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const CreditsRouter = require('../../../lib/server/routes/credits');
const errors = require('storj-service-error-types');
// const log = require('../../../lib/logger');
const routerOpts = require('../../_fixtures/router-opts');
const mongoose = require('mongoose');

describe('Credits Router', function() {
  const creditsRouter = new CreditsRouter(routerOpts);

  before(function(done) {
    var marketingDoc = new creditsRouter.models.Marketing({
      user: 'sender@example123.com',
      referralLink: 'abc-123'
    });

    var sender = new creditsRouter.models.User({
      _id: 'user@example.com',
      hashpass: storj.utils.sha256('password')
    });
    done();
  });

  describe('#handleSignups', function() {

    describe('#handleReferralSignups', function() {

      it('return create referral with valid props', function() {
        var request = httpMocks.createRequest({
          method: 'POST',
          url: '/signups',
          body: {}
        });

        var response = httpMocks.createResponse({
          req: request,
          eventEmitter: EventEmitter
        });

        creditsRouter.handleSignups(request, response);

        var data = response._getData();
        console.log(data);
        console.log(response.statusCode);
      });

    });

  });

});
