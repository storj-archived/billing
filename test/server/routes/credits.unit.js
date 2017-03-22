const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const CreditsRouter = require('../../../lib/server/routes/credits');
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');
const mongoose = require('mongoose');
const constants = require('../../../lib/constants');
const Config = require('../../../lib/config');
const Mailer = require('storj-service-mailer');

describe('Credits Router', function() {
  const creditsRouter = new CreditsRouter(routerOpts);
  let sandbox;

  beforeEach(function(done) {
    sandbox = sinon.sandbox.create();
    done();
  });

  afterEach(function(done) {
    sandbox.restore();
    done()
  });

  describe('@constructor', function() {
    it('smoke test', function(done) {
      expect(creditsRouter.config).to.be.instanceOf(Config);
      expect(creditsRouter).to.be.instanceOf(CreditsRouter);
      expect(creditsRouter.mailer).to.be.instanceOf(Mailer);
      expect(creditsRouter.models).to.be.ok;
      done();
    });
  });

  describe('#handleSignups', function() {

    describe('#handleReferralSignups', function() {

      it('create referral with valid props', function(done) {
        const handleSignupsSpy = sandbox.spy(creditsRouter, 'handleSignups')
        const mockMarketingDoc = new creditsRouter.models.Marketing({
          user: 'lott.dylan@gmail.com',
          created: Date.now(),
          referralLink: 'abc-123'
        });

        const marketingDoc = new creditsRouter.models.Marketing({
          user: 'sender@example123.com',
          referralLink: 'abc-123'
        });

        const sender = new creditsRouter.models.User({
          _id: 'user@example.com',
          hashpass: storj.utils.sha256('password')
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
            referralLink: 'abc-123'
          },
          recipient: {
            email: 'recipient@example.com',
            amount_to_credit: 1234,
          },
          created: Date.now(),
          count: 1
        });

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
          const data = res._getData();
          console.log('### CREATE CREDIT ###', data);
          expect(res.statusCode).to.equal(200);
          expect(res.statusMessage).to.equal('OK');
          expect(data.recipient).to.be.ok;
          expect(data.sender).to.be.ok;
          expect(data.recipient.min_spent_requirement).to.equal(constants.PROMO_AMOUNT.MIN_SPENT_REQUIREMENT)
          expect(data.recipient.email).to.equal(req.body.email);
          expect(data.recipient.amount_to_credit).to.equal(mockReferral.recipient.amount_to_credit);
          expect(data.sender.referralLink).to.equal(req.body.referralLink);
          expect(data.sender.amount_to_credit).to.equal(mockReferral.sender.amount_to_credit);
        });

        creditsRouter.handleSignups(req, res);

        expect(handleSignupsSpy.callCount).to.equal(1);
        console.log('#### HANDLE SIGNUPS FINISHED');
        done();
      });

      it('should handleRegularSignup if referralLink invalid', function(done) {
        const err = {
          message: 'Invalid referral link'
        }

        var req = httpMocks.createRequest({
          method: 'POST',
          url: '/signups',
          body: {
            email: 'user@example.com',
            referralLink: 'invalidreferrallink'
          }
        });

        var res = httpMocks.createResponse({
          req: req,
          eventEmitter: EventEmitter
        });

        const mockMarketing = new creditsRouter.models.Marketing({
          user: req.body.email,
          created: Date.now(),
          referralLink: req.body.referralLink
        });

        const mockCredit = new creditsRouter.models.Credit({
          user: req.body.email
        });

        var isValid = sandbox.stub(creditsRouter.models.Marketing, 'isValidReferralLink')
          .returnsPromise();
        isValid.rejects(err);

        var _create = sandbox.stub(creditsRouter.models.Marketing, 'create')
          .callsArgWith(1)

        var issueRegular = sandbox.spy(creditsRouter, '_issueRegularSignupCredit');
        var handleRegular = sandbox.spy(creditsRouter, 'handleRegularSignup');
        expect(issueRegular).to.have.been.called;
        creditsRouter.handleSignups(req, res);
        done();
      });

      it('should return error if marketing#create fails', function(done) {
        var req = httpMocks.createRequest({
          method: 'POST',
          url: '/signups',
          body: {
            email: 'user@example.com',
            referralLink: 'abc-123'
          }
        });

        var res = httpMocks.createResponse({
          req: req,
          eventEmitter: EventEmitter
        });

        var _create = sandbox.stub(creditsRouter.models.Marketing, 'create')
          .callsArgWith(1, new Error('Panic!'));

        res.on('end', function() {
          const data = res._getData();
          console.log('### marketing Create error ###', data);
          expect(res.statusCode).to.equal(500);
          expect(data).to.be.instanceOf(Error);
        });

        creditsRouter.handleSignups(req, res);
        done();
      });

      it('should call handleReferralSignup', function(done) {
        var req = httpMocks.createRequest({
          method: 'POST',
          url: '/signups',
          body: {
            email: 'user@example.com',
            referralLink: 'abc-123'
          }
        });

        var res = httpMocks.createResponse({
          req: req,
          eventEmitter: EventEmitter
        });

        const mockMarketing = new creditsRouter.models.Marketing({
          user: req.body.email,
          created: Date.now(),
          referralLink: req.body.referralLink
        });

        var _create = sandbox.stub(creditsRouter.models.Marketing, 'create')
          .callsArgWith(1, null, mockMarketing);
        var _handleReferral = sandbox.spy(creditsRouter, 'handleReferralSignup');

        creditsRouter.handleSignups(req, res);
        expect(_handleReferral.called).to.equal(true);
        done();
      });

      it('should call handleRegularSignup if no referral', function(done){
        var req = httpMocks.createRequest({
          method: 'POST',
          url: '/signups',
          body: {
            email: 'user@example.com'
          }
        });

        var res = httpMocks.createResponse({
          req: req,
          eventEmitter: EventEmitter
        });

        const mockMarketing = new creditsRouter.models.Marketing({
          user: req.body.email,
          created: Date.now(),
          referralLink: req.body.referralLink
        });
        var _create = sandbox.stub(creditsRouter.models.Marketing, 'create')
          .callsArgWith(1, null, mockMarketing);

        var _handleRegular = sandbox.spy(creditsRouter, 'handleRegularSignup');

        creditsRouter.handleSignups(req, res);
        expect(_handleRegular.called).to.equal(true);
        expect(_handleRegular.callCount).to.equal(1);
        done();
      });

      it('#_issueRegularSignupCredit', function(done) {
        const data = {
          email: 'user@example.com'
        };

        creditsRouter._issueRegularSignupCredit(data);

        done();
      });

    });

  });

});
