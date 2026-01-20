const express = require('express');
const { protect, admin } = require('../middleware/auth');
const { createRateLimiters } = require('../middleware/security');

// Controllers
const cartController = require('../controllers/cartController');
const wishlistController = require('../controllers/wishlistController');
const paymentController = require('../controllers/paymentController');
const searchController = require('../controllers/searchController');
const {
    getDashboardStats,
    getSalesAnalytics,
    getUserAnalytics,
    getProductAnalytics,
    exportAnalytics
} = require('../controllers/admin/analyticsController');

const router = express.Router();
const { apiLimiter, paymentLimiter } = createRateLimiters();

// Cart Routes
router.get('/cart', protect, cartController.getCart);
router.post('/cart/add', protect, apiLimiter, cartController.addToCart);
router.put('/cart/items/:itemId', protect, cartController.updateCartItem);
router.delete('/cart/items/:itemId', protect, cartController.removeFromCart);
router.delete('/cart/clear', protect, cartController.clearCart);
router.post('/cart/move-to-wishlist/:itemId', protect, cartController.moveToWishlist);

// Wishlist Routes
router.get('/wishlist', protect, wishlistController.getWishlist);
router.post('/wishlist/add', protect, wishlistController.addToWishlist);
router.delete('/wishlist/:productId', protect, wishlistController.removeFromWishlist);
router.post('/wishlist/move-to-cart/:productId', protect, wishlistController.moveToCart);

// Payment Routes
router.post('/payments/create-intent', protect, paymentLimiter, paymentController.createPaymentIntent);
router.post('/payments/confirm', protect, paymentLimiter, paymentController.confirmPayment);
router.post('/payments/refund', protect, admin, paymentController.processRefund);
router.get('/payments/methods', paymentController.getPaymentMethods);

// Search Routes
router.get('/search', searchController.searchProducts);
router.get('/search/suggestions', searchController.getSearchSuggestions);
router.get('/search/popular', searchController.getPopularSearches);
router.post('/search/track', searchController.trackSearch);

// Admin Analytics Routes
router.get('/admin/analytics/dashboard', protect, admin, getDashboardStats);
router.get('/admin/analytics/sales', protect, admin, getSalesAnalytics);
router.get('/admin/analytics/users', protect, admin, getUserAnalytics);
router.get('/admin/analytics/products', protect, admin, getProductAnalytics);
router.get('/admin/analytics/export', protect, admin, exportAnalytics);

module.exports = router;