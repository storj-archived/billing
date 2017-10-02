const Coinpayments = require('coinpayments');

const options = {
  key: process.env.CP_PUBLIC_KEY,
  secret: process.env.CP_PRIVATE_KEY,
  autoIpn: true
}

const client = new Coinpayments(options);

client.on('ipn_fail', function (data) {
  // update credits to reflect failed
  console.log('ipn fail')
  console.log('ipn fail data: ', data);
  const debit = this.models.Debit;
  const credit = this.models.Credit;
});

client.on('ipn_pending', function(data){
  console.log("IPN PENDING");
  console.log(data);
  const debit = this.models.Debit;
  const credit = this.models.Credit;
  // update credits to reflect unverified
});

client.on('ipn_complete', function(data){
  console.log("IPN COMPLETE");
  // update debits and credits to reflect success
  const debit = this.models.Debit;
  const credit = this.models.Credit;

  console.log(data);
});

module.exports = client;
