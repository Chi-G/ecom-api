const { sequelize } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');

const getDashboardStats = async (req, res, next) => {
    try {
        const [
            totalUsers,
            totalOrders,
            totalProducts,
            totalRevenue,
            pendingOrders,
            recentOrders,
            lowStockProducts,
            topSellingProducts
        ] = await Promise.all([
            // Total users
            sequelize.models.User.count(),

            // Total orders
            sequelize.models.Order.count(),

            // Total products
            sequelize.models.Product.count({ where: { is_active: true } }),

            // Total revenue
            sequelize.models.Order.sum('total_amount', {
                where: { status: ['delivered', 'completed'] }
            }),

            // Pending orders
            sequelize.models.Order.count({
                where: { status: ['pending', 'processing'] }
            }),

            // Recent orders (last 7 days)
            sequelize.models.Order.findAll({
                where: {
                    created_at: {
                        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                },
                include: [{
                    model: sequelize.models.User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                }],
                order: [['created_at', 'DESC']],
                limit: 10
            }),

            // Low stock products
            sequelize.models.Product.findAll({
                where: {
                    stock: { [Op.lte]: 10 },
                    is_active: true
                },
                order: [['stock', 'ASC']],
                limit: 10
            }),

            // Top selling products
            sequelize.query(`
        SELECT p.id, p.name, p.price, SUM(oi.quantity) as total_sold
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('delivered', 'completed')
        AND p.is_active = true
        GROUP BY p.id, p.name, p.price
        ORDER BY total_sold DESC
        LIMIT 10
      `, { type: sequelize.QueryTypes.SELECT })
        ]);

        res.json({
            success: true,
            data: {
                overview: {
                    total_users: totalUsers || 0,
                    total_orders: totalOrders || 0,
                    total_products: totalProducts || 0,
                    total_revenue: parseFloat(totalRevenue) || 0,
                    pending_orders: pendingOrders || 0
                },
                recent_orders: recentOrders,
                low_stock_products: lowStockProducts,
                top_selling_products: topSellingProducts
            }
        });
    } catch (error) {
        next(error);
    }
};

const getSalesAnalytics = async (req, res, next) => {
    try {
        const { period = '7d' } = req.query;

        let dateFilter;
        const now = new Date();

        switch (period) {
            case '24h':
                dateFilter = new Date(now - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                dateFilter = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                dateFilter = new Date(now - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                dateFilter = new Date(now - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                dateFilter = new Date(now - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                dateFilter = new Date(now - 7 * 24 * 60 * 60 * 1000);
        }

        const [
            salesTrend,
            categoryPerformance,
            paymentMethodStats,
            customerStats
        ] = await Promise.all([
            // Sales trend over time
            sequelize.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue
        FROM orders
        WHERE created_at >= :dateFilter
        AND status IN ('delivered', 'completed')
        GROUP BY DATE(created_at)
        ORDER BY date
      `, {
                replacements: { dateFilter },
                type: sequelize.QueryTypes.SELECT
            }),

            // Category performance
            sequelize.query(`
        SELECT 
          c.name as category,
          COUNT(DISTINCT o.id) as order_count,
          SUM(oi.quantity) as items_sold,
          SUM(oi.price * oi.quantity) as revenue
        FROM categories c
        JOIN products p ON c.id = p.category_id
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= :dateFilter
        AND o.status IN ('delivered', 'completed')
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `, {
                replacements: { dateFilter },
                type: sequelize.QueryTypes.SELECT
            }),

            // Payment method statistics
            sequelize.query(`
        SELECT 
          payment_method,
          COUNT(*) as usage_count,
          SUM(total_amount) as total_amount
        FROM orders
        WHERE created_at >= :dateFilter
        AND status IN ('delivered', 'completed')
        GROUP BY payment_method
        ORDER BY usage_count DESC
      `, {
                replacements: { dateFilter },
                type: sequelize.QueryTypes.SELECT
            }),

            // Customer statistics
            sequelize.query(`
        SELECT 
          CASE 
            WHEN order_count = 1 THEN 'new'
            WHEN order_count BETWEEN 2 AND 5 THEN 'returning'
            ELSE 'loyal'
          END as customer_type,
          COUNT(*) as customer_count,
          AVG(total_spent) as avg_spent
        FROM (
          SELECT 
            user_id,
            COUNT(*) as order_count,
            SUM(total_amount) as total_spent
          FROM orders
          WHERE created_at >= :dateFilter
          AND status IN ('delivered', 'completed')
          GROUP BY user_id
        ) user_orders
        GROUP BY customer_type
      `, {
                replacements: { dateFilter },
                type: sequelize.QueryTypes.SELECT
            })
        ]);

        res.json({
            success: true,
            data: {
                sales_trend: salesTrend,
                category_performance: categoryPerformance,
                payment_method_stats: paymentMethodStats,
                customer_stats: customerStats
            }
        });
    } catch (error) {
        next(error);
    }
};

const getUserAnalytics = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, sortBy = 'total_spent', order = 'DESC' } = req.query;

        const offset = (page - 1) * limit;

        const users = await sequelize.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        COUNT(o.id) as total_orders,
        SUM(o.total_amount) as total_spent,
        AVG(o.total_amount) as avg_order_value,
        MAX(o.created_at) as last_order_date
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.status IN ('delivered', 'completed')
      GROUP BY u.id, u.name, u.email, u.created_at
      ORDER BY ${sortBy} ${order}
      LIMIT :limit OFFSET :offset
    `, {
            replacements: { limit: parseInt(limit), offset },
            type: sequelize.QueryTypes.SELECT
        });

        const totalCount = await sequelize.models.User.count();

        res.json({
            success: true,
            data: users,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / limit),
                total_items: totalCount,
                items_per_page: parseInt(limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

const getProductAnalytics = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, sortBy = 'total_revenue', order = 'DESC' } = req.query;

        const offset = (page - 1) * limit;

        const products = await sequelize.query(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.stock,
        c.name as category,
        COALESCE(SUM(oi.quantity), 0) as total_sold,
        COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('delivered', 'completed')
      LEFT JOIN reviews r ON p.id = r.product_id AND r.is_active = true
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.price, p.stock, c.name
      ORDER BY ${sortBy} ${order}
      LIMIT :limit OFFSET :offset
    `, {
            replacements: { limit: parseInt(limit), offset },
            type: sequelize.QueryTypes.SELECT
        });

        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        next(error);
    }
};

const exportAnalytics = async (req, res, next) => {
    try {
        const { format = 'json', type = 'sales' } = req.query;

        let data;
        let filename;

        switch (type) {
            case 'sales':
                data = await getSalesData();
                filename = 'sales-analytics';
                break;
            case 'users':
                data = await getUserAnalyticsData();
                filename = 'user-analytics';
                break;
            case 'products':
                data = await getProductAnalyticsData();
                filename = 'product-analytics';
                break;
            default:
                return res.status(400).json({ message: 'Invalid export type' });
        }

        if (format === 'csv') {
            const { Parser } = require('json2csv');
            const parser = new Parser();
            const csv = parser.parse(data);

            res.header('Content-Type', 'text/csv');
            res.attachment(`${filename}.csv`);
            return res.send(csv);
        } else if (format === 'excel') {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Analytics');

            worksheet.addRow(Object.keys(data[0]));
            data.forEach(row => worksheet.addRow(Object.values(row)));

            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment(`${filename}.xlsx`);

            return workbook.xlsx.write(res);
        } else {
            res.json({
                success: true,
                data
            });
        }
    } catch (error) {
        next(error);
    }
};

// Helper functions for data export
const getSalesData = async () => {
    return await sequelize.query(`
        SELECT 
          o.id as order_id,
          u.name as customer_name,
          o.total_amount,
          o.status as order_status,
          o.payment_status,
          o.payment_method,
          o.created_at as order_date
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.status IN ('processing', 'shipped', 'delivered', 'completed')
        AND o.payment_status = 'completed'
        ORDER BY o.created_at DESC
    `, { type: sequelize.QueryTypes.SELECT });
};

const getUserAnalyticsData = async () => {
    return await sequelize.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at as joined_date,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value,
        MAX(o.created_at) as last_order_date
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.status IN ('processing', 'shipped', 'delivered', 'completed')
      GROUP BY u.id, u.name, u.email, u.created_at
      ORDER BY total_spent DESC
    `, { type: sequelize.QueryTypes.SELECT });
};

const getProductAnalyticsData = async () => {
    return await sequelize.query(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.stock,
        c.name as category,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
        COALESCE(AVG(r.rating), 0) as avg_rating
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('processing', 'shipped', 'delivered', 'completed')
      LEFT JOIN reviews r ON p.id = r.product_id AND r.is_active = true
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.price, p.stock, c.name
      ORDER BY total_revenue DESC
    `, { type: sequelize.QueryTypes.SELECT });
};

module.exports = {
    getDashboardStats,
    getSalesAnalytics,
    getUserAnalytics,
    getProductAnalytics,
    exportAnalytics
};