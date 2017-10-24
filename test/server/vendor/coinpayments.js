const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const coinpayments = require('../../../lib/server/vendor/coinpayments');

describe('#coinpayments', () => {
  it('should return coinpayments client', (done) => {
    console.log('coinpayments', coinpayments);
    expect(coinpayments).to.not.equal(undefined);
    expect(coinpayments).to.be.instanceOf(Object);
    expect(coinpayments.credentials).to.be.instanceOf(Object);
    done();
  });
});
