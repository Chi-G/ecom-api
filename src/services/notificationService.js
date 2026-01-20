const { sendEmail } = require('../config/email');
const { sequelize } = require('../models');
const redis = require('../config/redis');

const sendOrderConfirmation = async (orderId, userEmail) => {
    try {
        const order = await sequelize.models.Order.findByPk(orderId, {
            include: [
                {
                    model: sequelize.models.User,
                    as: 'user',
                    attributes: ['name', 'email']
                },
                {
                    model: sequelize.models.OrderItem,
                    as: 'items',
                    include: [{
                        model: sequelize.models.Product,
                        as: 'product',
                        attributes: ['name', 'images']
                    }]
                }
            ]
        });

        if (!order) return;

        // Generate HTML email template
        const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .order-details { background: #f8f9fa; padding: 20px; margin: 20px 0; }
          .item { border-bottom: 1px solid #ddd; padding: 10px 0; }
          .total { font-weight: bold; font-size: 18px; }
          .footer { text-align: center; margin-top: 30px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmation</h1>
          </div>
          
          <p>Dear ${order.user.name},</p>
          <p>Thank you for your order! We're pleased to confirm that your order has been received and is being processed.</p>
          
          <div class="order-details">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> #${order.id}</p>
            <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> $${order.total_amount.toFixed(2)}</p>
          </div>
          
          <h3>Order Items</h3>
          ${order.items.map(item => `
            <div class="item">
              <strong>${item.product.name}</strong><br>
              Quantity: ${item.quantity} | Price: $${item.price.toFixed(2)} | Subtotal: $${(item.price * item.quantity).toFixed(2)}
            </div>
          `).join('')}
          
          <div class="total">
            <p>Total: $${order.total_amount.toFixed(2)}</p>
          </div>
          
          <div class="footer">
            <p>If you have any questions, please contact our customer service.</p>
            <p>Thank you for shopping with us!</p>
          </div>
        </div>
      </body>
      </html>
    `;

        await sendEmail(
            userEmail,
            `Order Confirmation - #${orderId}`,
            `Your order #${orderId} has been confirmed. Total: $${order.total_amount.toFixed(2)}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending order confirmation:', error);
    }
};

const sendShippingNotification = async (orderId, trackingNumber, carrier) => {
    try {
        const order = await sequelize.models.Order.findByPk(orderId, {
            include: [{
                model: sequelize.models.User,
                as: 'user',
                attributes: ['name', 'email']
            }]
        });

        if (!order) return;

        const htmlContent = `
      <h1>Your Order Has Shipped!</h1>
      <p>Dear ${order.user.name},</p>
      <p>Great news! Your order #${orderId} has been shipped and is on its way to you.</p>
      <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
      <p><strong>Carrier:</strong> ${carrier}</p>
      <p>You can track your package using the tracking number provided above.</p>
      <p>Thank you for shopping with us!</p>
    `;

        await sendEmail(
            order.user.email,
            `Order Shipped - #${orderId}`,
            `Your order #${orderId} has been shipped. Tracking: ${trackingNumber}`,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending shipping notification:', error);
    }
};

const sendLowStockAlert = async (productId, currentStock) => {
    try {
        const product = await sequelize.models.Product.findByPk(productId);
        if (!product) return;

        // Get admin users
        const admins = await sequelize.models.User.findAll({
            where: { role: 'admin', is_active: true }
        });

        const htmlContent = `
      <h1>Low Stock Alert</h1>
      <p>The following product is running low on stock:</p>
      <p><strong>Product:</strong> ${product.name}</p>
      <p><strong>Current Stock:</strong> ${currentStock}</p>
      <p><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
      <p>Please consider restocking this item.</p>
    `;

        for (const admin of admins) {
            await sendEmail(
                admin.email,
                `Low Stock Alert - ${product.name}`,
                `Low stock alert: ${product.name} has only ${currentStock} units remaining.`,
                htmlContent
            );
        }
    } catch (error) {
        console.error('Error sending low stock alert:', error);
    }
};

const sendAbandonedCartReminder = async (userId) => {
    try {
        const user = await sequelize.models.User.findByPk(userId);
        if (!user) return;

        const cart = await sequelize.models.Cart.findOne({
            where: { user_id: userId },
            include: [{
                model: sequelize.models.CartItem,
                as: 'items',
                include: [{
                    model: sequelize.models.Product,
                    as: 'product'
                }]
            }]
        });

        if (!cart || cart.items.length === 0) return;

        const htmlContent = `
      <h1>Don't Forget Your Items!</h1>
      <p>Hi ${user.name},</p>
      <p>You have items waiting in your cart. Complete your purchase before they're gone!</p>
      
      <h3>Items in your cart:</h3>
      ${cart.items.map(item => `
        <div>
          <strong>${item.product.name}</strong> - $${item.price.toFixed(2)} x ${item.quantity}
        </div>
      `).join('')}
      
      <p><strong>Total: $${cart.total_amount.toFixed(2)}</strong></p>
      
      <p><a href="${process.env.FRONTEND_URL}/cart" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Purchase</a></p>
    `;

        await sendEmail(
            user.email,
            'Complete Your Purchase',
            'You have items in your cart waiting for you.',
            htmlContent
        );
    } catch (error) {
        console.error('Error sending abandoned cart reminder:', error);
    }
};

const sendPromotionalEmail = async (userId, promotionData) => {
    try {
        const user = await sequelize.models.User.findByPk(userId);
        if (!user) return;

        const htmlContent = `
      <h1>${promotionData.title}</h1>
      <p>Hi ${user.name},</p>
      <p>${promotionData.description}</p>
      
      ${promotionData.products && promotionData.products.length > 0 ? `
        <h3>Featured Products</h3>
        ${promotionData.products.map(product => `
          <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0;">
            <strong>${product.name}</strong><br>
            <span style="text-decoration: line-through;">$${product.original_price}</span>
            <strong style="color: #e74c3c;">$${product.discount_price}</strong>
          </div>
        `).join('')}
      ` : ''}
      
      <p><a href="${promotionData.link || process.env.FRONTEND_URL}" style="background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Shop Now</a></p>
      
      <p><small>This promotion expires on ${new Date(promotionData.expires_at).toLocaleDateString()}</small></p>
    `;

        await sendEmail(
            user.email,
            promotionData.title,
            promotionData.description,
            htmlContent
        );
    } catch (error) {
        console.error('Error sending promotional email:', error);
    }
};

module.exports = {
    sendOrderConfirmation,
    sendShippingNotification,
    sendLowStockAlert,
    sendAbandonedCartReminder,
    sendPromotionalEmail
};