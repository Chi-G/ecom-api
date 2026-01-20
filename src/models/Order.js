const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false
  },
  shipping_address_street: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  shipping_address_city: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  shipping_address_state: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  shipping_address_zip_code: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  shipping_address_country: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  payment_method: {
    type: DataTypes.ENUM('credit_card', 'debit_card', 'paypal', 'cash_on_delivery'),
    allowNull: false
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    defaultValue: 'pending',
    allowNull: false
  },
  order_notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'orders',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = Order;