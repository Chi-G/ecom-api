const { body, validationResult } = require('express-validator');

// validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// user validation rules
const validateRegister = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required'),
  validate,
];

// product validation rules
const validateProduct = [
  body('name').trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('description').trim().isLength({ min: 1 }).withMessage('Product description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category_id').isInt({ min: 1 }).withMessage('Valid Category ID is required'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  validate,
];

// order validation rules
const validateOrder = [
  body('order_items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('order_items.*.product_id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  body('order_items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('shipping_address.street').trim().isLength({ min: 1 }).withMessage('Street address is required'),
  body('shipping_address.city').trim().isLength({ min: 1 }).withMessage('City is required'),
  body('shipping_address.state').trim().isLength({ min: 1 }).withMessage('State is required'),
  body('shipping_address.zip_code').trim().isLength({ min: 1 }).withMessage('ZIP code is required'),
  body('shipping_address.country').trim().isLength({ min: 1 }).withMessage('Country is required'),
  body('payment_method').isIn(['credit_card', 'debit_card', 'paypal', 'cash_on_delivery']).withMessage('Invalid payment method'),
  validate,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProduct,
  validateOrder,
};