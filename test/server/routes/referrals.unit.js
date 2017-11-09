const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const stubPromise = require('sinon-stub-promise');
stubPromise(sinon);
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const Config = require('../../../lib/config');
const ReferralsRouter = require('../../../lib/server/routes/referrals');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');
const Mailer = require('storj-service-mailer');
const Storage = require('storj-service-storage-models');
const defaults = require('../../../lib/config.js').DEFAULTS;
const mailer = new Mailer(defaults.mailer);
const Promise = require('bluebird');

let sandbox;

beforeEach(function() {
  sandbox = sinon.sandbox.create();
});

afterEach(function() {
  sandbox.restore();
});

describe('#referralsRouter', function() {
  const referrals = new ReferralsRouter(routerOpts);

  describe('@constructor', function() {
    it('smoke test', function(done) {
      expect(referrals).to.be.instanceOf(ReferralsRouter);
      expect(referrals.storage).to.be.instanceOf(Storage);
      expect(referrals.mailer).to.be.instanceOf(Mailer);
      expect(referrals.config).to.be.instanceOf(Config);
      done();
    });
  });

  describe('#sendReferralEmail', function() {
    it('should send referral email', function(done) {

      done();
    });
  });

  describe('#_sendEmail', function() {
    it('send email', function(done) {
      const sender = 'sender@example.com';
      const recipient = 'recipient@example.com';
      const marketing = new referrals.storage.models.Marketing({
        user: 'dylan@storj.io',
        referralLink: 'abc-123'
      });

      const _dispatch = sinon.stub(Mailer.prototype, 'dispatch')
        .callsArgWith(3, null);

      const refs = referrals._sendEmail(sender, recipient, marketing);

      expect(refs).to.be.instanceOf(Promise);
      expect(_dispatch.callCount).to.equal(1);
      done();
    });
  });
});
