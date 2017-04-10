var sinon = require('sinon');
var expect = require('chai').expect;
var stripe = require('../../../lib/server/vendor/stripe');

afterEach(() => {
  delete process.env.NODE_ENV;
});

describe('#stripe', function() {

  it('it should return stripe instance', function(done) {
    expect(stripe).to.not.equal(undefined);
    expect(stripe).to.be.instanceOf(Object);
    done();
  });

})
