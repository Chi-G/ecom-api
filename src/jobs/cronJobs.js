const cron = require('node-cron');
const { Order, Product, Cart, User } = require('../models');
const { sequelize } = require('../config/database');
const notificationService = require('../services/notificationService');
const redis = require('../config/redis');

// Schedule jobs
const startCronJobs = () => {
    console.log('Starting cron jobs...');

    // Run every hour - Check for low stock products
    cron.schedule('0 * * * *', async () => {
        console.log('Running low stock check...');
        await checkLowStockProducts();
    });

    // Run daily at 2 AM - Send abandoned cart reminders
    cron.schedule('0 2 * * *', async () => {
        console.log('Sending abandoned cart reminders...');
        await sendAbandonedCartReminders();
    });

    // Run daily at 3 AM - Clean up expired carts
    cron.schedule('0 3 * * *', async () => {
        console.log('Cleaning up expired carts...');
        await cleanupExpiredCarts();
    });

    // Run weekly on Sunday - Generate analytics reports
    cron.schedule('0 4 * * 0', async () => {
        console.log('Generating weekly analytics...');
        await generateWeeklyAnalytics();
    });

    // Run monthly on 1st - Update product popularity scores
    cron.schedule('0 5 1 * *', async () => {
        console.log('Updating product popularity scores...');
        await updateProductPopularity();
    });

    // Run daily at 1 AM - Process pending payments
    cron.schedule('0 1 * * *', async () => {
        console.log('Processing pending payments...');
        await processPendingPayments();
    });
};

const checkLowStockProducts = async () => {
    try {
        const lowStockProducts = await Product.findAll({
            where: {
                stock: { [Op.lte]: 10 },
                is_active: true
            }
        });

        for (const product of lowStockProducts) {
            // Check if alert was already sent in last 24 hours
            const cacheKey = `low_stock_alert:${product.id}`;
            const alertSent = await redis.get(cacheKey);

            if (!alertSent) {
                await notificationService.sendLowStockAlert(product.id, product.stock);
                await redis.setex(cacheKey, 86400, 'sent'); // 24 hours
            }
        }
    } catch (error) {
        console.error('Error checking low stock products:', error);
    }
};

const sendAbandonedCartReminders = async () => {
    try {
        const abandonedCarts = await Cart.findAll({
            where: {
                updated_at: {
                    [Op.lte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
                },
                item_count: { [Op.gt]: 0 }
            },
            include: [{
                model: User,
                as: 'user',
                where: { is_active: true },
                attributes: ['id', 'name', 'email']
            }]
        });

        for (const cart of abandonedCarts) {
            // Check if reminder was already sent
            const cacheKey = `abandoned_cart:${cart.user_id}`;
            const reminderSent = await redis.get(cacheKey);

            if (!reminderSent) {
                await notificationService.sendAbandonedCartReminder(cart.user_id);
                await redis.setex(cacheKey, 259200, 'sent'); // 3 days
            }
        }
    } catch (error) {
        console.error('Error sending abandoned cart reminders:', error);
    }
};

const cleanupExpiredCarts = async () => {
    try {
        const expiredCarts = await Cart.findAll({
            where: {
                expires_at: { [Op.lte]: new Date() },
                item_count: { [Op.gt]: 0 }
            }
        });

        for (const cart of expiredCarts) {
            // Restore product stock
            const cartItems = await sequelize.models.CartItem.findAll({
                where: { cart_id: cart.id },
                include: [{ model: Product, as: 'product' }]
            });

            for (const item of cartItems) {
                await item.product.increment('stock', { by: item.quantity });
            }

            // Clear cart items
            await sequelize.models.CartItem.destroy({
                where: { cart_id: cart.id }
            });

            // Reset cart
            await cart.update({
                item_count: 0,
                total_amount: 0
            });
        }

        console.log(`Cleaned up ${expiredCarts.length} expired carts`);
    } catch (error) {
        console.error('Error cleaning up expired carts:', error);
    }
};

const generateWeeklyAnalytics = async () => {
    try {
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalRevenue,
            totalOrders,
            newUsers,
            topProducts
        ] = await Promise.all([
            Order.sum('total_amount', {
                where: {
                    created_at: { [Op.gte]: lastWeek },
                    status: ['delivered', 'completed']
                }
            }),

            Order.count({
                where: {
                    created_at: { [Op.gte]: lastWeek },
                    status: ['delivered', 'completed']
                }
            }),

            User.count({
                where: {
                    created_at: { [Op.gte]: lastWeek }
                }
            }),

            sequelize.query(`
        SELECT 
          p.name,
          SUM(oi.quantity) as total_sold,
          SUM(oi.price * oi.quantity) as revenue
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= :lastWeek
        AND o.status IN ('delivered', 'completed')
        GROUP BY p.id, p.name
        ORDER BY total_sold DESC
        LIMIT 10
      `, {
                replacements: { lastWeek },
                type: sequelize.QueryTypes.SELECT
            })
        ]);

        // Store analytics in database or send report
        const report = {
            period: 'weekly',
            start_date: lastWeek,
            end_date: new Date(),
            total_revenue: totalRevenue || 0,
            total_orders: totalOrders || 0,
            new_users: newUsers || 0,
            top_products: topProducts,
            generated_at: new Date()
        };

        // Here you could save to database or send email report
        console.log('Weekly Analytics Report:', report);

    } catch (error) {
        console.error('Error generating weekly analytics:', error);
    }
};

const updateProductPopularity = async () => {
    try {
        // Calculate popularity score based on sales, views, and reviews
        await sequelize.query(`
      UPDATE products p
      SET popularity_score = (
        SELECT 
          (COALESCE(SUM(oi.quantity), 0) * 10) +           -- Sales weight: 10
          (COALESCE(COUNT(rv.id), 0) * 5) +               -- Reviews weight: 5
          (COALESCE(p.average_rating, 0) * 20)            -- Rating weight: 20
        FROM order_items oi
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('delivered', 'completed')
        LEFT JOIN reviews rv ON p.id = rv.product_id AND rv.is_active = true
        WHERE oi.product_id = p.id
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      )
      WHERE p.is_active = true
    `);

        console.log('Updated product popularity scores');
    } catch (error) {
        console.error('Error updating product popularity:', error);
    }
};

const processPendingPayments = async () => {
    try {
        const pendingPayments = await sequelize.models.Payment.findAll({
            where: {
                status: 'pending',
                created_at: {
                    [Op.lte]: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
                }
            },
            include: [{
                model: Order,
                as: 'order'
            }]
        });

        for (const payment of pendingPayments) {
            // Check payment status with gateway
            // This is a simplified example - implement based on your payment provider
            try {
                // Update payment status
                await payment.update({
                    status: 'failed',
                    failure_reason: 'Payment timeout'
                });

                // Update order status
                await payment.order.update({
                    payment_status: 'failed'
                });

                console.log(`Updated payment ${payment.id} to failed due to timeout`);
            } catch (error) {
                console.error(`Error processing payment ${payment.id}:`, error);
            }
        }
    } catch (error) {
        console.error('Error processing pending payments:', error);
    }
};

module.exports = {
    startCronJobs
};