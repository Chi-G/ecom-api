const { Wishlist, Product } = require('../models');

const getWishlist = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const wishlist = await Wishlist.findAll({
            where: { user_id: userId },
            include: [{
                model: Product,
                as: 'product',
                where: { is_active: true },
                required: false,
                include: [{
                    model: require('../models/Category'),
                    as: 'category',
                    attributes: ['id', 'name']
                }]
            }],
            order: [['added_at', 'DESC']]
        });

        res.json({
            success: true,
            data: wishlist
        });
    } catch (error) {
        next(error);
    }
};

const addToWishlist = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.body;

        const product = await Product.findByPk(productId);
        if (!product || !product.is_active) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const [wishlistItem, created] = await Wishlist.findOrCreate({
            where: { user_id: userId, product_id: productId },
            defaults: {
                user_id: userId,
                product_id: productId
            }
        });

        if (!created) {
            return res.status(400).json({ message: 'Product already in wishlist' });
        }

        res.status(201).json({
            success: true,
            data: wishlistItem,
            message: 'Product added to wishlist successfully'
        });
    } catch (error) {
        next(error);
    }
};

const removeFromWishlist = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        const deletedRows = await Wishlist.destroy({
            where: { user_id: userId, product_id: productId }
        });

        if (deletedRows === 0) {
            return res.status(404).json({ message: 'Product not found in wishlist' });
        }

        res.json({
            success: true,
            message: 'Product removed from wishlist successfully'
        });
    } catch (error) {
        next(error);
    }
};

const moveToCart = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        // Check if item exists in wishlist
        const wishlistItem = await Wishlist.findOne({
            where: { user_id: userId, product_id: productId }
        });

        if (!wishlistItem) {
            return res.status(404).json({ message: 'Product not found in wishlist' });
        }

        // Add to cart (reuse cart controller)
        const cartController = require('./cartController');
        req.body = { productId, quantity: 1 };

        // Call addToCart but preserve original response format
        const originalJson = res.json;
        let cartResponse = null;

        res.json = function (data) {
            cartResponse = data;
            originalJson.call(this, data);
        };

        await cartController.addToCart(req, res, next);

        // Remove from wishlist if cart addition was successful
        if (cartResponse && cartResponse.success) {
            await wishlistItem.destroy();
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    moveToCart
};