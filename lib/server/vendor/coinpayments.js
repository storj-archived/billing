const Coinpayments = require('coinpayments');

const options = {
  key: process.env.CP_PUBLIC_KEY,
  secret: process.env.CP_PRIVATE_KEY
}

const client = new Coinpayments(options);

// client.getCallbackAddress('BTC', (err, response) => {
//   if (err) console.error('Error getting callback address; ', err);
//   console.log('###### CALLBACK ADDRESS: ', response);
// });

module.exports = client;
