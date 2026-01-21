const { Payment, Order } = require('../models');
const { sequelize } = require('../config/database');
const { sendOrderConfirmation } = require('./notificationService');

const completeOrderFulfillment = async (paymentIntentId) => {
    const transaction = await sequelize.transaction();

    try {
        const payment = await Payment.findOne({
            where: { transaction_id: paymentIntentId },
            include: [{ model: Order, as: 'order' }],
            transaction
        });

        if (!payment) {
            console.error(`Payment not found for transaction: ${paymentIntentId}`);
            await transaction.rollback();
            return { success: false, message: 'Payment not found' };
        }

        if (payment.status === 'completed') {
            await transaction.rollback();
            return { success: true, message: 'Payment already processed' };
        }

        // Update payment record
        await payment.update({
            status: 'completed',
            processed_at: new Date()
        }, { transaction });

        // Update order status
        await payment.order.update({
            payment_status: 'completed',
            status: 'processing'
        }, { transaction });

        await transaction.commit();

        const orderWithUser = await Order.findByPk(payment.order_id, {
            include: [{ model: require('../models/User'), as: 'user' }]
        });

        if (orderWithUser && orderWithUser.user) {
            sendOrderConfirmation(orderWithUser.id, orderWithUser.user.email);
        }

        return { success: true };
    } catch (error) {
        await transaction.rollback();
        console.error('Fulfillment error:', error);
        throw error;
    }
};

const handlePaymentFailure = async (paymentIntentId, reason) => {
    try {
        const payment = await Payment.findOne({
            where: { transaction_id: paymentIntentId }
        });

        if (payment) {
            await payment.update({
                status: 'failed',
                failure_reason: reason
            });
        }
    } catch (error) {
        console.error('Error handling payment failure:', error);
    }
};

module.exports = {
    completeOrderFulfillment,
    handlePaymentFailure
};
