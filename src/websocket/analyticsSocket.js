const socketIO = require('socket.io');
const { Order, Product, User } = require('../models');

let io;

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('Analytics client connected:', socket.id);

        socket.on('subscribe_dashboard', () => {
            socket.join('dashboard');
            sendDashboardData(socket);
        });

        socket.on('subscribe_product', (productId) => {
            socket.join(`product_${productId}`);
            sendProductAnalytics(socket, productId);
        });

        socket.on('disconnect', () => {
            console.log('Analytics client disconnected:', socket.id);
        });
    });

    // Start real-time data broadcasting
    startRealTimeUpdates();
};

const sendDashboardData = async (socket) => {
    try {
        const [
            totalRevenue,
            totalOrders,
            totalUsers,
            recentOrders,
            topProducts
        ] = await Promise.all([
            Order.sum('total_amount', {
                where: { status: ['delivered', 'completed'] }
            }),
            Order.count(),
            User.count(),
            Order.findAll({
                limit: 5,
                order: [['created_at', 'DESC']],
                include: [{ model: User, as: 'user', attributes: ['name'] }]
            }),
            sequelize.query(`
        SELECT p.name, SUM(oi.quantity) as sold
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('delivered', 'completed')
        GROUP BY p.id
        ORDER BY sold DESC
        LIMIT 5
      `, { type: sequelize.QueryTypes.SELECT })
        ]);

        socket.emit('dashboard_update', {
            total_revenue: parseFloat(totalRevenue) || 0,
            total_orders: totalOrders || 0,
            total_users: totalUsers || 0,
            recent_orders: recentOrders,
            top_products: topProducts,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error sending dashboard data:', error);
    }
};

const sendProductAnalytics = async (socket, productId) => {
    try {
        const [
            product,
            salesData,
            reviewStats
        ] = await Promise.all([
            Product.findByPk(productId),
            sequelize.query(`
        SELECT 
          DATE(created_at) as date,
          SUM(quantity) as sold,
          SUM(price * quantity) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = :productId
        AND o.status IN ('delivered', 'completed')
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
      `, {
                replacements: { productId },
                type: sequelize.QueryTypes.SELECT
            }),
            Review.findAll({
                where: { product_id: productId, is_active: true },
                attributes: [
                    [fn('COUNT', col('id')), 'total_reviews'],
                    [fn('AVG', col('rating')), 'avg_rating']
                ]
            })
        ]);

        socket.emit('product_analytics', {
            product_name: product.name,
            sales_data: salesData,
            review_stats: reviewStats[0],
            current_stock: product.stock,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error sending product analytics:', error);
    }
};

const startRealTimeUpdates = () => {
    // update dashboard every 30 seconds
    setInterval(async () => {
        const sockets = io.sockets.adapter.rooms.get('dashboard');
        if (sockets && sockets.size > 0) {
            const socketIds = Array.from(sockets);
            for (const socketId of socketIds) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    await sendDashboardData(socket);
                }
            }
        }
    }, 30000);

    // update product analytics every 10 seconds
    setInterval(async () => {
        const productRooms = Object.keys(io.sockets.adapter.rooms).filter(room =>
            room.startsWith('product_')
        );

        for (const room of productRooms) {
            const productId = room.replace('product_', '');
            const sockets = io.sockets.adapter.rooms.get(room);

            if (sockets && sockets.size > 0) {
                const socketIds = Array.from(sockets);
                for (const socketId of socketIds) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                        await sendProductAnalytics(socket, productId);
                    }
                }
            }
        }
    }, 10000);
};

// emit real-time events
const emitOrderUpdate = (orderData) => {
    if (io) {
        io.emit('order_update', orderData);
    }
};

const emitProductUpdate = (productData) => {
    if (io) {
        io.emit('product_update', productData);
    }
};

const emitInventoryAlert = (productId, stockLevel) => {
    if (io) {
        io.emit('inventory_alert', {
            product_id: productId,
            stock_level: stockLevel,
            timestamp: new Date()
        });
    }
};

module.exports = {
    initializeSocket,
    emitOrderUpdate,
    emitProductUpdate,
    emitInventoryAlert
};