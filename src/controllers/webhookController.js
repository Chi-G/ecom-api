const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fulfillmentService = require('../services/fulfillmentService');

const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
                await fulfillmentService.completeOrderFulfillment(paymentIntent.id);
                break;

            case 'payment_intent.payment_failed':
                const failedIntent = event.data.object;
                console.error(`PaymentIntent for ${failedIntent.amount} failed: ${failedIntent.last_payment_error?.message}`);
                await fulfillmentService.handlePaymentFailure(failedIntent.id, failedIntent.last_payment_error?.message);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook event:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    handleStripeWebhook
};
