const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Payment, Order } = require('../models');
const { sequelize } = require('../config/database');

const createPaymentIntent = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const { orderId, paymentMethod = 'stripe' } = req.body;
        const userId = req.user.id;

        const order = await Order.findByPk(orderId, {
            include: [{
                model: require('../models/User'),
                as: 'user',
                attributes: ['id', 'name', 'email']
            }],
            transaction
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user_id !== userId) {
            await transaction.rollback();
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (order.payment_status === 'completed') {
            await transaction.rollback();
            return res.status(400).json({ message: 'Order already paid' });
        }

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.total_amount * 100), // Convert to cents
            currency: 'usd',
            metadata: {
                orderId: orderId,
                userId: userId
            },
            description: `Order #${orderId} - ${order.user.name}`
        });

        // Create payment record
        const payment = await Payment.create({
            order_id: orderId,
            payment_method: paymentMethod,
            amount: order.total_amount,
            currency: 'usd',
            status: 'pending',
            transaction_id: paymentIntent.id,
            gateway_response: paymentIntent
        }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            data: {
                client_secret: paymentIntent.client_secret,
                payment_id: payment.id
            }
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

const confirmPayment = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const { paymentId, paymentIntentId } = req.body;

        const payment = await Payment.findByPk(paymentId, {
            include: [{ model: Order, as: 'order' }],
            transaction
        });

        if (!payment) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            // Update payment record
            await payment.update({
                status: 'completed',
                processed_at: new Date(),
                gateway_response: paymentIntent
            }, { transaction });

            // Update order
            await payment.order.update({
                payment_status: 'completed',
                status: 'processing'
            }, { transaction });

            // Send confirmation email
            const { sendEmail } = require('../config/email');
            await sendEmail(
                payment.order.user.email,
                'Payment Confirmation',
                `Your payment for order #${payment.order.id} has been confirmed.`,
                `<h1>Payment Confirmed</h1><p>Your payment has been processed successfully.</p>`
            );

            await transaction.commit();

            res.json({
                success: true,
                message: 'Payment confirmed successfully'
            });
        } else {
            await transaction.rollback();
            res.status(400).json({
                success: false,
                message: 'Payment not completed'
            });
        }
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

const processRefund = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const { orderId, amount, reason } = req.body;

        const order = await Order.findByPk(orderId, {
            include: [{ model: Payment, as: 'payments' }],
            transaction
        });

        if (!order) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        const completedPayment = order.payments.find(p => p.status === 'completed');
        if (!completedPayment) {
            await transaction.rollback();
            return res.status(400).json({ message: 'No completed payment found' });
        }

        // Process refund with Stripe
        const refund = await stripe.refunds.create({
            payment_intent: completedPayment.transaction_id,
            amount: Math.round(amount * 100), // Convert to cents
            reason: reason || 'requested_by_customer',
            metadata: {
                orderId: orderId,
                adminId: req.user.id
            }
        });

        // Create refund payment record
        const refundPayment = await Payment.create({
            order_id: orderId,
            payment_method: completedPayment.payment_method,
            amount: -amount, // Negative for refund
            currency: completedPayment.currency,
            status: 'refunded',
            transaction_id: refund.id,
            gateway_response: refund,
            failure_reason: reason
        }, { transaction });

        // Update order status
        await order.update({
            status: 'refunded'
        }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            data: {
                refund_id: refund.id,
                amount: amount,
                status: refund.status
            }
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

const getPaymentMethods = async (req, res, next) => {
    try {
        const paymentMethods = [
            {
                id: 'credit_card',
                name: 'Credit Card',
                type: 'card',
                supported: true
            },
            {
                id: 'debit_card',
                name: 'Debit Card',
                type: 'card',
                supported: true
            },
            {
                id: 'paypal',
                name: 'PayPal',
                type: 'wallet',
                supported: false // Configure in production
            },
            {
                id: 'stripe',
                name: 'Stripe',
                type: 'gateway',
                supported: true
            },
            {
                id: 'cash_on_delivery',
                name: 'Cash on Delivery',
                type: 'cod',
                supported: true
            }
        ];

        res.json({
            success: true,
            data: paymentMethods
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPaymentIntent,
    confirmPayment,
    processRefund,
    getPaymentMethods
};