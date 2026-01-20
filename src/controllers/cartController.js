const { Cart, CartItem, Product } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

const getCart = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({
            where: { user_id: userId },
            include: [{
                model: CartItem,
                as: 'items',
                include: [{
                    model: Product,
                    as: 'product',
                    where: { is_active: true },
                    required: false
                }]
            }],
            order: [[{ model: CartItem, as: 'items' }, 'added_at', 'DESC']]
        });

        if (!cart) {
            return res.json({
                success: true,
                data: {
                    id: null,
                    items: [],
                    total_amount: 0,
                    item_count: 0
                }
            });
        }

        // Calculate current totals
        let currentTotal = 0;
        let validItems = 0;

        cart.items.forEach(item => {
            if (item.product && item.product.stock >= item.quantity) {
                currentTotal += parseFloat(item.price) * item.quantity;
                validItems++;
            }
        });

        // Update cart totals if changed
        if (currentTotal !== parseFloat(cart.total_amount) || validItems !== cart.item_count) {
            await cart.update({
                total_amount: currentTotal,
                item_count: validItems
            });
        }

        res.json({
            success: true,
            data: cart
        });
    } catch (error) {
        next(error);
    }
};

const addToCart = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const userId = req.user.id;
        const { productId, quantity = 1 } = req.body;

        // Find or create cart
        let [cart] = await Cart.findOrCreate({
            where: { user_id: userId },
            defaults: {
                user_id: userId,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            },
            transaction
        });

        // Check product availability
        const product = await Product.findByPk(productId, { transaction });
        if (!product || !product.is_active) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.stock < quantity) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Insufficient stock' });
        }

        // Find existing cart item
        const existingItem = await CartItem.findOne({
            where: { cart_id: cart.id, product_id: productId },
            transaction
        });

        if (existingItem) {
            // Update quantity
            const newQuantity = existingItem.quantity + quantity;
            if (product.stock < newQuantity) {
                await transaction.rollback();
                return res.status(400).json({ message: 'Insufficient stock for updated quantity' });
            }

            await existingItem.update({
                quantity: newQuantity,
                price: product.price
            }, { transaction });
        } else {
            // Create new cart item
            await CartItem.create({
                cart_id: cart.id,
                product_id: productId,
                quantity,
                price: product.price
            }, { transaction });
        }

        // Update cart totals
        const cartItems = await CartItem.findAll({
            where: { cart_id: cart.id },
            include: [{ model: Product, as: 'product' }],
            transaction
        });

        const totalAmount = cartItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        const itemCount = cartItems.length;

        await cart.update({
            total_amount: totalAmount,
            item_count: itemCount
        }, { transaction });

        await transaction.commit();

        // Return updated cart
        const updatedCart = await Cart.findByPk(cart.id, {
            include: [{
                model: CartItem,
                as: 'items',
                include: [{ model: Product, as: 'product' }]
            }]
        });

        res.json({
            success: true,
            data: updatedCart,
            message: 'Product added to cart successfully'
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

const updateCartItem = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const userId = req.user.id;
        const { itemId } = req.params;
        const { quantity } = req.body;

        const cart = await Cart.findOne({ where: { user_id: userId } });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartItem = await CartItem.findOne({
            where: { id: itemId, cart_id: cart.id },
            include: [{ model: Product, as: 'product' }],
            transaction
        });

        if (!cartItem) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Cart item not found' });
        }

        if (cartItem.product.stock < quantity) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Insufficient stock' });
        }

        if (quantity === 0) {
            await cartItem.destroy({ transaction });
        } else {
            await cartItem.update({ quantity }, { transaction });
        }

        // Update cart totals
        const cartItems = await CartItem.findAll({
            where: { cart_id: cart.id },
            include: [{ model: Product, as: 'product' }],
            transaction
        });

        const totalAmount = cartItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        const itemCount = cartItems.length;

        await cart.update({
            total_amount: totalAmount,
            item_count: itemCount
        }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            message: 'Cart updated successfully'
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

const removeFromCart = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const userId = req.user.id;
        const { itemId } = req.params;

        const cart = await Cart.findOne({ where: { user_id: userId } });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartItem = await CartItem.findOne({
            where: { id: itemId, cart_id: cart.id },
            transaction
        });

        if (!cartItem) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Cart item not found' });
        }

        await cartItem.destroy({ transaction });

        // Update cart totals
        const cartItems = await CartItem.findAll({
            where: { cart_id: cart.id },
            transaction
        });

        const totalAmount = cartItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        const itemCount = cartItems.length;

        await cart.update({
            total_amount: totalAmount,
            item_count: itemCount
        }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            message: 'Item removed from cart successfully'
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

const clearCart = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({ where: { user_id: userId } });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        await CartItem.destroy({
            where: { cart_id: cart.id },
            transaction
        });

        await cart.update({
            total_amount: 0,
            item_count: 0
        }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            message: 'Cart cleared successfully'
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

const moveToWishlist = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
        const userId = req.user.id;
        const { itemId } = req.params;

        const cart = await Cart.findOne({ where: { user_id: userId } });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartItem = await CartItem.findOne({
            where: { id: itemId, cart_id: cart.id },
            include: [{ model: Product, as: 'product' }],
            transaction
        });

        if (!cartItem) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Cart item not found' });
        }

        // Add to wishlist
        const { Wishlist } = require('../models');
        await Wishlist.create({
            user_id: userId,
            product_id: cartItem.product_id
        }, { transaction });

        // Remove from cart
        await cartItem.destroy({ transaction });

        // Update cart totals
        const cartItems = await CartItem.findAll({
            where: { cart_id: cart.id },
            transaction
        });

        const totalAmount = cartItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        const itemCount = cartItems.length;

        await cart.update({
            total_amount: totalAmount,
            item_count: itemCount
        }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            message: 'Item moved to wishlist successfully'
        });
    } catch (error) {
        await transaction.rollback();
        next(error);
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    moveToWishlist
};