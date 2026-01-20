const { Order, OrderItem, Product, User } = require('../models');
const { sequelize } = require('../config/database');
const { sendEmail } = require('../config/email');

const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { order_items, shipping_address, payment_method, order_notes } = req.body;

    // validate stock and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of order_items) {
      const product = await Product.findByPk(item.product_id, {
        transaction,
        lock: true
      });

      if (!product) {
        await transaction.rollback();
        return res.status(404).json({ message: `Product ${item.product_id} not found` });
      }

      if (product.stock < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      const itemTotal = parseFloat(product.price) * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price: product.price,
      });

      // update product stock
      product.stock -= item.quantity;
      await product.save({ transaction });
    }

    // create order
    const order = await Order.create({
      user_id: req.user.id,
      total_amount: totalAmount,
      shipping_address_street: shipping_address.street,
      shipping_address_city: shipping_address.city,
      shipping_address_state: shipping_address.state,
      shipping_address_zip_code: shipping_address.zip_code,
      shipping_address_country: shipping_address.country,
      payment_method: payment_method,
      order_notes: order_notes,
    }, { transaction });

    // create order items
    for (const item of orderItems) {
      await OrderItem.create({
        order_id: order.id,
        ...item
      }, { transaction });
    }

    await transaction.commit();
    let isCommitted = true;

    // send order confirmation email (non-blocking)
    try {
      const user = await User.findByPk(req.user.id);
      await sendEmail(
        user.email,
        'Order Confirmation',
        `Your order #${order.id} has been placed successfully. Total: $${totalAmount.toFixed(2)}`,
        `<h1>Order Confirmation</h1><p>Your order #${order.id} has been placed successfully.</p><p>Total: $${totalAmount.toFixed(2)}</p>`
      );
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
      // do not fail the request if email fails, as order is already placed
    }

    // fetch complete order with items
    const completeOrder = await Order.findByPk(order.id, {
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'images']
        }]
      }]
    });

    res.status(201).json({
      success: true,
      data: completeOrder,
    });
  } catch (error) {
    // Only rollback if transaction hasn't been committed yet
    if (transaction && !transaction.finished && transaction.connection) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Transaction rollback failed:', rollbackError);
      }
    }
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      include: [{
        model: OrderItem,
        as: 'items',
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'images']
        }]
      }],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'images']
          }]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // make sure user owns order or is admin
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Not authorized to view this order' });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const [updatedRows] = await Order.update(
      { status },
      { where: { id: req.params.id } }
    );

    if (updatedRows === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = await Order.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }]
    });

    // send status update email
    await sendEmail(
      order.user.email,
      'Order Status Update',
      `Your order #${order.id} status has been updated to: ${status}`,
      `<h1>Order Status Update</h1><p>Your order #${order.id} status has been updated to: <strong>${status}</strong></p>`
    );

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name']
          }]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
    });

    res.json({
      success: true,
      data: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  getOrders,
};