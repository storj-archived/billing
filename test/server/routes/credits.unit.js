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
  let sandbox;

  beforeEach(function(done) {
    sandbox = sinon.sandbox.create();

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

  afterEach(function() {
    // how do afterEach apply to it / describe blocks ??
    sandbox.restore();
  });

  describe('#handleSignups', function() {

    describe('#handleReferralSignups', function() {

      it('return create referral with valid props', function() {
        sandbox.stub();
        var request = httpMocks.createRequest({
          method: 'POST',
          url: '/signups',
          body: {
            email: 'recipient@example.com',
            referralLink: 'abc-123'
          }
        });

        var response = httpMocks.createResponse({
          req: request,
          eventEmitter: EventEmitter
        });

        response.on('end', function() {
          console.log('this doesnt fire');
        });

        response.on('error', function(err){
          console.log('Error: ', err);
        });

        //stub marketing create
        creditsRouter.handleSignups(request, response);
        expect(response.statusCode).to.equal(200);
      });

    });

  });

});
