const stripe = require('stripe');
return module.exports = stripe(process.env.STRIPE_KEY);
