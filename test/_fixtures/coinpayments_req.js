module.exports = (opts) => {
  const _opts = opts || {};

  const obj = {
    ipn_version: '1.0',
    ipn_id: _opts.ipn_id || 'c139436d4b05aada3b426512a246ffc9',
    ipn_mode: 'hmac',
    merchant: _opts.merchant || 'd8b86a9501771dee3e5068f652121536',
    ipn_type: _opts.ipn_type || 'deposit',
    address: _opts.address || '0xa01a891af7a29e5a3d650b3271eda165ce195856',
    txn_id: _opts.txn_id || '0x055b36e6d360b7682993f3a8a751f6c2e914c3c3f9d7fa42b69b199b35ca4229',
    status: _opts.status || '100',
    status_text: 'Deposit confirmed',
    currency: _opts.currency || 'STORJ',
    amount: _opts.amount || '0.00010000',
    amounti: _opts.amounti || '10000',
    fee: _opts.fee || '0.00000050',
    feei: _opts.feei || '50',
    confirms: _opts.confirms || '21'
  }

  return obj;
}
