const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/auth');
const { validateProduct } = require('../middleware/validation');

const router = express.Router();

router.route('/')
  .get(getProducts)
  .post(protect, admin, validateProduct, createProduct);

router.route('/:id')
  .get(getProduct)
  .put(protect, admin, validateProduct, updateProduct)
  .delete(protect, admin, deleteProduct);

module.exports = router;