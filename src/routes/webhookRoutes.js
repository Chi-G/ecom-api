const express = require('express');
const webhookController = require('../controllers/webhookController');
const router = express.Router();

// This route needs the raw body for Stripe signature verification
// We'll apply the express.raw middleware specifically to this route in app.js
// or here if we want to be very specific.
router.post('/stripe', express.raw({ type: 'application/json' }), webhookController.handleStripeWebhook);

module.exports = router;
