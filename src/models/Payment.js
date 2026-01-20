const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'orders',
            key: 'id'
        }
    },
    payment_method: {
        type: DataTypes.ENUM('credit_card', 'debit_card', 'paypal', 'stripe', 'razorpay', 'cash_on_delivery'),
        allowNull: false
    },
    transaction_id: {
        type: DataTypes.STRING(255),
        unique: true
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'USD'
    },
    status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
        defaultValue: 'pending'
    },
    gateway_response: {
        type: DataTypes.JSON
    },
    failure_reason: {
        type: DataTypes.TEXT
    },
    processed_at: {
        type: DataTypes.DATE
    }
}, {
    tableName: 'payments',
    indexes: [
        { fields: ['order_id'] },
        { fields: ['transaction_id'] },
        { fields: ['status'] }
    ]
});

module.exports = Payment;