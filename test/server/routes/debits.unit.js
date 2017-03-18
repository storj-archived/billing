const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
require('sinon-as-promised');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const Config = require('../../../lib/config');
const DebitsRouter = require('../../../lib/server/routes/debits');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
const routerOpts = require('../../_fixtures/router-opts');

let sandbox;

beforeEach(function() {
  sandbox = sinon.sandbox.create();
});

afterEach(function() {
  sandbox.restore();
});

describe('#debitsRouter', function() {
  const debitsRouter = new DebitsRouter(routerOpts);

  describe('smoke test', function() {
    it('debitsRouter should exist with proper configs', function(done) {
      expect(debitsRouter).to.be.ok;
      expect(debitsRouter.storage).to.be.ok;
      expect(debitsRouter.models).to.be.ok;
      expect(debitsRouter.mailer).to.be.ok;
      expect(debitsRouter.contracts).to.be.ok;
      expect(debitsRouter.config).to.equal(routerOpts.config);
      done();
    });
  });

  describe('#createDebit', function() {


    it('should create a debit and return the debit object', function(done) {
      // var mockUser = new debitsRouter.storage.models.User({
      //   _id: 'dylan@storj.io',
      //   hashpass: storj.utils.sha256('password')
      // });
      //
      var mockDebit = new debitsRouter.storage.models.Debit({
        amount: 666,
        user: 'lott.dylan@gmail.com',
        type: 'bandwidth',
        created: new Date()
      });

      var req = httpMocks.createRequest({
        method: 'POST',
        url: '/debits',
        body: {
          user: "user@example.com",
          type: "bandwidth",
          amount: 123456,
          created: new Date()
        }
      });

      var res = httpMocks.createResponse({
        eventEmitter: EventEmitter,
        req: req
      });

      var _createDebit = sandbox
        .stub(debitsRouter.storage.models.Debit, 'create')
        .resolves(mockDebit)()
        .then((data) => {
          // console.log(data);

          res.on('send', function() {
            console.log('res on send: ', res._getData());
          });

          res.on('end', function() {
            console.log('res on data', res._getData());
          });

          debitsRouter.createDebit(req, res);
          done();
        });
      // console.log(res._getData());
    });

    // it('should return 500 error code', function(done) {
    //   var req = httpMocks.createRequest({
    //     method: 'POST',
    //     url: '/debits'
    //   });
    //
    //   var res = httpMocks.createResponse({
    //     eventEmitter: EventEmitter,
    //     req: req
    //   });
    //
    //   sandbox.stub(debitsRouter.storage.models.Debit, 'create')
    //     .withArgs({
    //       user: "user@example.com",
    //       type: "bandwidth",
    //       amount: 123456,
    //       created: new Date()
    //     })
    //
    //   debitsRouter.createDebit(req, res);
    //
    //   expect(res._getData()).to.equal(500);
    //   expect(res.body.error).to.be.ok;
    //   done();
    // });

  });

});
