const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const CreditsRouter = require('../../../lib/server/routes/credits');
const errors = require('storj-service-error-types');
// const log = require('../../../lib/logger');
const routerOpts = require('../../_fixtures/router-opts');
const mongoose = require('mongoose');
const constants = require('../../../lib/constants');

describe('Credits Router', function() {
  console.log('### NODE_ENV: ', process.env.NODE_ENV);
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
    creditsRouter.models.Marketing.find({}).remove();
    creditsRouter.models.Credit.find({}).remove();
    creditsRouter.models.Referral.find({}).remove();
    sandbox.restore();
  });

  describe('#handleSignups', function() {

    describe('#handleReferralSignups', function() {

      it('create referral with valid props', function(done) {
        const mockMarketingDoc = new creditsRouter.models.Marketing({
          user: 'lott.dylan@gmail.com',
          created: Date.now(),
          referralLink: 'abc-123'
        });

        sandbox.stub(creditsRouter.models.Marketing, 'create')
          .callsArg(1);

        const mockCredit = new creditsRouter.models.Credit({
          invoiced_amount: 1234,
          user: 'lott.dylan@gmail.com'
        });

        const mockReferral = new creditsRouter.models.Referral({
          sender: {
            email: 'sender@example.com',
            amount_to_credit: 1234,
            credit: '',
            referralLink: 'abc-123'
          },
          recipient: {
            email: 'recipient@example.com',
            amount_to_credit: 1234,
          },
          created: Date.now(),
          count: 1
        })

        var req = httpMocks.createRequest({
          method: 'POST',
          url: '/signups',
          body: {
            email: 'recipient@example.com',
            referralLink: 'abc-123'
          }
        });

        var res = httpMocks.createResponse({
          req: req,
          eventEmitter: EventEmitter
        });

        var isValidPromise = sandbox.stub(creditsRouter.models.Marketing, 'isValidReferralLink')
          .returnsPromise();
        isValidPromise.resolves(mockMarketingDoc);

        var getReferralPromise = sandbox.stub(creditsRouter, '_getReferral')
          .returnsPromise();
        getReferralPromise.resolves(req.body, mockMarketingDoc);

        var issueReferralPromise = sandbox.stub(creditsRouter, '_issueReferralSignupCredit')
          .returnsPromise();
        issueReferralPromise.resolves(mockCredit);

        var convertReferral = sandbox.stub(creditsRouter, '_convertReferralRecipient')
          .returnsPromise();
        convertReferral.resolves(mockReferral);

        res.on('end', function() {
          expect(res.statusCode).to.equal(200);
          expect(res.statusMessage).to.equal('OK');
          const data = res._getData();
          console.log(data);
          // console.log('### DATA ###', data);
          expect(data.recipient).to.be.ok;
          expect(data.sender).to.be.ok;
          expect(data.recipient.email).to.equal(req.body.email);
          expect(data.sender.referralLink).to.equal(req.body.referralLink);
          expect(data.sender.amount_to_credit).to.equal(mockReferral.sender.amount_to_credit);
        });

        creditsRouter.handleSignups(req, res);
        done();
      });

    });

  });

});
