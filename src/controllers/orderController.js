const { Order, OrderItem, Product, User } = require('../models');
const { sequelize } = require('../config/database');
const { sendOrderConfirmation, sendOrderStatusUpdate } = require('../services/notificationService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const APIFeatures = require('../utils/apiFeatures');
const logger = require('../utils/logger');

const createOrder = catchAsync(async (req, res, next) => {
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
        throw new AppError(`Product ${item.product_id} not found`, 404);
      }

      if (product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
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

    logger.info(`Order created: ${order.id} by user ${req.user.id}`);

    // send order confirmation email (non-blocking)
    try {
      const user = await User.findByPk(req.user.id);
      await sendOrderConfirmation(order.id, user.email);
    } catch (emailError) {
      logger.error('Failed to send order confirmation email', emailError);
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
    if (transaction) await transaction.rollback();
    throw error;
  }
});

const getMyOrders = catchAsync(async (req, res, next) => {
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
});

const getOrder = catchAsync(async (req, res, next) => {
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
    return next(new AppError('Order not found', 404));
  }

  // make sure user owns order or is admin
  if (order.user_id !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Not authorized to view this order', 403));
  }

  res.json({
    success: true,
    data: order,
  });
});

const updateOrderStatus = catchAsync(async (req, res, next) => {
  if (!req.body.status) {
    return next(new AppError('Status is required', 400));
  }
  const { status } = req.body;

  const [updatedRows] = await Order.update(
    { status },
    { where: { id: req.params.id } }
  );

  if (updatedRows === 0) {
    return next(new AppError('Order not found', 404));
  }

  const order = await Order.findByPk(req.params.id, {
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'name', 'email']
    }]
  });

  // send status update email
  try {
    await sendOrderStatusUpdate(order.id, status);
  } catch (err) {
    logger.error('Failed to send status update email', err);
  }

  res.json({
    success: true,
    data: order,
  });
});

const getOrders = catchAsync(async (req, res, next) => {
  // Use APIFeatures for standard pagination/filtering
  const features = new APIFeatures(req.query)
    .filter()
    .sort()
    .paginate();

  const { count, rows: orders } = await Order.findAndCountAll({
    ...features.options,
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
    distinct: true
  });

  res.json({
    success: true,
    data: orders,
    pagination: {
      currentPage: features.page,
      totalPages: Math.ceil(count / features.limit),
      totalItems: count,
      itemsPerPage: features.limit,
    },
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  getOrders,
};