const Coinpayments = require('coinpayments');

const options = {
  key: process.env.CP_PUBLIC_KEY,
  secret: process.env.CP_PRIVATE_KEY,
  autoIpn: process.env.NODE_ENV === 'production' ? false : true
}

let client;

try {
  client = new Coinpayments(options);
} catch (err) {
  if (err.message === 'Missing public key and/or secret') {
    console.log(err.message);
    return;
  } else {
    throw(err);
  }
}

module.exports = client;
