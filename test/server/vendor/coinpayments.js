const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const coinpayments = require('../../../lib/server/vendor/coinpayments');

describe('#coinpayments', () => {
  it('should return coinpayments client', (done) => {
    const client = coinpayments();
    expect(client).to.not.equal(undefined);
    expect(client).to.be.instanceOf(Object);
    expect(client.credentials).to.be.instanceOf(Object);
    done();
  });
});
