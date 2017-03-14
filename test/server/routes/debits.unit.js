const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const EventEmitter = require('events').EventEmitter;
const DebitsRouter = require('../../../lib/server/routes/debits');
const ReadableStream = require('stream').Readable;
const errors = require('storj-service-error-types');
// const log = require('../../../lib/logger');

describe('Debits Router', function() {

  const debitsRouter = new DebitsRouter('../../_fixtures/router-opts');

  describe('#_ create debits', function() {
    it('it should create a debit', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/debits'
      });

      request.user = someUser;
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });

      debitsRouter.createDebit(request, response, function(err) {
        expect(err).to.be(undefined);
        done();
      });

    });
  });
});
