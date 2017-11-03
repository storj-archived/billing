const Coinpayments = require('coinpayments');

const options = {
  key: process.env.CP_PUBLIC_KEY,
  secret: process.env.CP_PRIVATE_KEY,
  autoIpn: process.env.NODE_ENV === 'production' ? false : true
}

const client = new Coinpayments(options);

module.exports = client;
