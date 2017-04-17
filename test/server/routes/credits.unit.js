const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const storj = require('storj-lib');
const expect = require('chai').expect;
const assert = require('chai').assert;
const Promise = require('bluebird');
require('sinon-bluebird');
const EventEmitter = require('events').EventEmitter;
const CreditsRouter = require('../../../lib/server/routes/credits');
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');
const mongoose = require('mongoose');
const constants = require('../../../lib/constants');
const Config = require('../../../lib/config');
const Mailer = require('storj-service-mailer');

describe('Credits Router', function() {
  const credits = new CreditsRouter(routerOpts);
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
      expect(credits.config).to.be.instanceOf(Config);
      expect(credits).to.be.instanceOf(CreditsRouter);
      expect(credits.mailer).to.be.instanceOf(Mailer);
      expect(credits.models).to.be.ok;
      done();
    });
  });

  describe('#handleReferralSignup', () => {
    it('should ping handleReferralSignup', (done) => {
      const mockMarketing = new credits.models.Marketing({
        user: 'dylan@storj.io',
        referralLink: 'abc-123'
      });

      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/credits/signups',
        body: {
          email: 'dylan@storj.io',
          referralLink: 'abc-123'
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      res.on('end', () => {
        console.log('#### RETURN 200 #####', res._getData());

      })

      const _create = sandbox.stub(credits.storage.models.Marketing, 'create')
        .callsArgWith(1, null, mockMarketing)

      const _handleReferral = sandbox.spy(credits, 'handleReferralSignup')
      const _handleRegular = sandbox.spy(credits, 'handleRegularSignup')

      credits.handleSignups(req, res);
      expect(_handleRegular.callCount).to.equal(0);
      expect(_handleReferral.callCount).to.equal(1);
      done();
    });

    it('should ping handleRegularSignup', (done) => {
      const mockMarketing = new credits.models.Marketing({
        user: 'dylan@storj.io'
      });

      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/credits/signups',
        body: {
          email: 'dylan@storj.io'
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      const _create = sandbox.stub(credits.storage.models.Marketing, 'create')
        .callsArgWith(1, null, mockMarketing)

      const _handleReferral = sandbox.spy(credits, 'handleReferralSignup')
      const _handleRegular = sandbox.spy(credits, 'handleRegularSignup')

      credits.handleSignups(req, res);
      expect(_handleRegular.callCount).to.equal(1);
      expect(_handleReferral.callCount).to.equal(0);
      done();
    });

    it('#create should handle errors correctly', (done) => {
      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/credits/signups',
        body: {
          email: 'dylan@storj.io',
          referralLink: 'abc-123'
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      res.on('end', () => {
        const data = res._getData();
        expect(data).to.be.ok;
        expect(data).to.be.instanceOf(Error);
        expect(res.statusCode).to.equal(500);
        console.log('#### RETURN 500 ERROR #####', res._getData());
      });

      const _create = sandbox.stub(credits.storage.models.Marketing, 'create')
        .callsArgWith(1, new Error('Panic!'), null);

      const _handleReferral = sandbox.spy(credits, 'handleReferralSignup');
      const _handleRegular = sandbox.spy(credits, 'handleRegularSignup');

      credits.handleSignups(req, res);
      expect(_handleReferral.callCount).to.equal(0);
      expect(_handleRegular.callCount).to.equal(0);
      done();
    });
  });

  describe('#handleRegularSignup', () => {
    it('should issue regularSignupCredit', (done) => {
      const mockCredit = new credits.models.Credit({
        user: 'dylan@storj.io',
        invoiced_amount: 1000,
        paid_amount: 1000,
        type: 'manual'
      });

      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/credits/signups',
        body: {
          email: 'dylan@storj.io',
          referralLink: 'abc-123'
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      const _issue = sandbox.stub(credits, '_issueRegularSignupCredit')
        .returnsPromise();
      _issue.resolves(mockCredit);

      res.on('end', () => {
        const data = res._getData();
        expect(data.user).to.equal(mockCredit.user);
        expect(res.statusCode).to.equal(200);
        expect(data.created).to.be.instanceOf(Date);
        expect(data.id).to.be.a('string');
      });

      credits.handleRegularSignup(req, res);
      expect(_issue.callCount).to.equal(1);
      done();
    });

    it('should handle error correctly', (done) => {
      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/credits/signups',
        body: {
          email: 'dylan@storj.io',
          referralLink: 'abc-123'
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      const err = {
        message: 'Panic!'
      }
      const _issue = sandbox.stub(credits, '_issueRegularSignupCredit')
        .returnsPromise();
      _issue.rejects(err);

      res.on('end', () => {
        const data = res._getData();
        expect(data.message).to.equal('Panic!');
        console.log('DATA: ', data);
      });

      credits.handleRegularSignup(req, res);
      expect(_issue.callCount).to.equal(1);
      done();
    });
  });

  describe('#handleReferralSignup', () => {
    it('should return 200 and referral', (done) => {
      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/credits/signups',
        body: {
          email: 'dylan@storj.io',
          referralLink: 'abc-123'
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      const mockMarketing = new credits.models.Marketing({
        user: 'dylan@storj.io',
        referralLink: 'abc-123'
      });

      const mockReferral = new credits.models.Referral({
        sender: {
          referralLink: 'abc-123'
        },
        recipient: {
          amount_to_credit: 1000,
          email: 'recipient@storj.io'
        }
      });

      const mockCredit = new credits.models.Credit({
        user: 'dylan@storj.io',
        type: 'manual'
      });

      const _valid = sandbox.stub(credits.models.Marketing, 'isValidReferralLink')
        .returnsPromise();
      _valid.resolves(mockMarketing);

      const _getReferral = sandbox.stub(credits, '_getReferral')
        .returnsPromise();
      _getReferral.resolves(mockReferral);

      const _issueReferral = sandbox.stub(credits, '_issueReferralSignupCredit')
        .returnsPromise();
      _issueReferral.resolves(mockCredit);

      const _convert = sandbox.stub(credits, '_convertReferralRecipient')
        .returnsPromise();
      _convert.resolves(mockReferral);

      res.on('end', () => {
        console.log('##### HANDLE REFERRAL');
        expect(res.statusCode).to.equal(200);
        expect(res.statusMessage).to.equal('OK');
        const data = res._getData();
        expect(data.recipient).to.be.an('object');
        expect(data.sender).to.be.an('object');
        expect(data.count).to.be.a('number');
        expect(data.created).to.be.instanceOf(Date);
        expect(data.id).to.be.a('string');
        expect(data.recipient.email).to.equal(mockReferral.recipient.email);
        expect(data.recipient.min_spent_requirement).to.equal(1000);
        expect(data.sender.referralLink).to.equal(mockReferral.sender.referralLink);

        console.log(data);
      })

      credits.handleReferralSignup(req, res);
      expect(_valid.callCount).to.equal(1);
      expect(_getReferral.callCount).to.equal(1);
      expect(_issueReferral.callCount).to.equal(1);
      expect(_convert.callCount).to.equal(1);
      done();
    });

    it('should catch errors', (done) => {
      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/credits/signups',
        body: {
          email: 'dylan@storj.io',
          referralLink: 'abc-123'
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      const err = new errors.InternalError('Panic!');

      const _valid = sandbox.stub(credits.models.Marketing, 'isValidReferralLink')
        .returnsPromise();
      _valid.rejects(err);

      res.on('end', () => {
        const data = res._getData();
        expect(data.statusCode).to.equal(500);
        expect(data.message).to.equal('Panic!');
        console.log('#### PANIC!!!');
      });

      credits.handleReferralSignup(req, res);
      expect(_valid.callCount).to.equal(1);
      done();
    });

    it('should call handleRegular if invalid referral', (done) => {
        var req = httpMocks.createRequest({
          method: 'POST',
          url: '/credits/signups',
          body: {
            email: 'dylan@storj.io',
            referralLink: 'abc-123'
          }
        });

        var res = httpMocks.createResponse({
          eventEmitter: EventEmitter,
          req: req
        });

        const err = {
          message: 'Invalid referral link'
        }

        const _valid = sandbox.stub(credits.models.Marketing, 'isValidReferralLink')
          .returnsPromise();
        _valid.rejects(err);

        _handleRegular = sandbox.stub(credits, 'handleRegularSignup')

        credits.handleReferralSignup(req, res);
        expect(_valid.callCount).to.equal(1);
        expect(_handleRegular.callCount).to.equal(1);
        done();
    });
  });

  describe('#_issueRegularSignupCredit', () => {
      it('should return credit promise', (done) => {
        const data = {
          email: 'dylan@storj.io'
        }

        const mockCredit = credits.models.Credit({
          email: data.email
        });

        const _save = sandbox.stub(credits.models.Credit.prototype, 'save')
          .resolves(mockCredit);

        credits._issueRegularSignupCredit(data)
          .then((data) => {
            expect(data).to.be.an('object');
            expect(data.paid).to.equal(false);
            expect(data.payment_processor).to.equal('none')
            expect(data.data).to.equal(null);
            expect(data.created).to.be.instanceOf(Date);
            expect(_save.callCount).to.equal(1);
            done();
          });
      });

      it('should return error if problem saving', (done) => {
        const data = {
          email: 'dylan@storj.io'
        }

        const mockCredit = credits.models.Credit({
          email: data.email
        });

        const err = errors.InternalError('Panic Error!');

        const _save = sandbox.stub(credits.models.Credit.prototype, 'save')
          .rejects(err);

        credits._issueRegularSignupCredit(data)
          .then((data) => console.log('should not log'))
          .catch((err) => {
            console.log('this should log err: ', err)
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.equal('Panic Error!')
            expect(err.statusCode).to.equal(500);
            expect(_save.callCount).to.equal(1);
            done();
          });

      });
  });


  describe('#_getReferral', () => {
    it('should resolve referral if referral exists', (done) => {
      const mockReferral = new credits.models.Referral({
        sender: {
          referralLink: 'abc-123'
        },
        recipient: {
          amount_to_credit: 1000,
          email: 'recipient@storj.io'
        }
      });
      const _referral = sandbox.stub(credits.models.Referral, 'findOne')
        .returnsPromise()
      _referral.resolves(mockReferral);

      const data = {
        referralLink: 'abc-123',
        email: 'dylan@storj.io'
      }

      const marketing = {
        user: 'dylan@storj.io',
        referralLink: 'abc-123'
      }

      credits._getReferral(data, marketing)
        .then((data) => {
          expect(data.created).to.be.instanceOf(Date);
          expect(data.sender).to.be.ok;
          expect(data.recipient).to.be.ok;
          expect(data.recipient.email).to.equal(mockReferral.recipient.email);
          expect(data.sender.referralLink).to.equal(mockReferral.sender.referralLink);
          expect(data.recipient.min_spent_requirement).to.equal(1000);
          console.log('REFERRAL DATA: ', data)
        });

      done();
    });

    it('should create new referral if referral doesnt exist', (done) => {
      const _referral = sandbox.stub(credits.models.Referral, 'findOne')
        .returnsPromise()
      _referral.resolves(null);

      const mockReferral = new credits.models.Referral({
        sender: {
          referralLink: 'abc-123'
        },
        recipient: {
          amount_to_credit: 1000,
          email: 'recipient@storj.io'
        }
      });

      const data = {
        referralLink: 'abc-123',
        email: 'dylan@storj.io'
      }

      const marketing = {
        user: 'dylan@storj.io',
        referralLink: 'abc-123'
      }

      const _create = sandbox.stub(credits.models.Referral, 'create')
        .resolves(mockReferral);

      credits._getReferral(data, marketing)
        .then((data) => {
          expect(data.created).to.be.instanceOf(Date);
          expect(data.sender.referralLink).to.equal(mockReferral.sender.referralLink);
          expect(data.recipient.email).to.equal(mockReferral.recipient.email);
          expect(data).to.be.instanceOf(credits.models.Referral);
          expect(_referral.callCount).to.equal(1);
          expect(_create.callCount).to.equal(1);
          console.log('_getReferral none exists: ', data);
          done();
        });
    });

    it('should handle errors correctly', (done) => {
      const err = errors.InternalError('Panic!!!');

      const _referral = sandbox.stub(credits.models.Referral, 'findOne')
        .returnsPromise()
      _referral.rejects(err);

      const data = {
        referralLink: 'abc-123',
        email: 'dylan@storj.io'
      }

      const marketing = {
        user: 'dylan@storj.io',
        referralLink: 'abc-123'
      }

      credits._getReferral(data, marketing)
        .then((data) => assert(data, undefined))
        .catch((err) => {
          expect(err).to.be.instanceOf(Error);
          expect(err.statusCode).to.equal(500);
          console.log('_getReferral err: ', err);
          done();
        });
    });
  })

});
