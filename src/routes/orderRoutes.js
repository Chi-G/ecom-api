const express = require('express');
const {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  getOrders,
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');

const router = express.Router();

router.route('/')
  .post(protect, validateOrder, createOrder)
  .get(protect, admin, getOrders);

router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, admin, updateOrderStatus);

module.exports = router;