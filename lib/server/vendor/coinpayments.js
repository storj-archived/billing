const Coinpayments = require('coinpayments');

const options = {
  key: process.env.CP_PUBLIC_KEY,
  secret: process.env.CP_PRIVATE_KEY,
  autoIpn: process.env.NODE_ENV === 'production' ? false : true
}

let client;

if (options.key && options.secret) {
  client = new Coinpayments(options);
} else {
  console.error('Invalid Coinpayments Key or Secret');
  client = undefined;
}

module.exports = client;
