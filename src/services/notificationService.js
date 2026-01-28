const { sendEmail } = require('../config/email');
const { sequelize } = require('../models');

// Shared Email Styles
const emailStyles = `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
  .email-wrapper { width: 100%; background-color: #f4f4f4; padding: 20px; }
  .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
  .header { background: #1a1a1a; color: #ffffff; padding: 30px 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px; }
  .content { padding: 40px 30px; }
  .greeting { font-size: 20px; color: #1a1a1a; margin-bottom: 20px; }
  .message { color: #555; margin-bottom: 30px; }
  .order-summary { background: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0; border: 1px solid #e9ecef; }
  .order-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
  .order-row:last-child { border-bottom: none; }
  .total-row { border-top: 2px solid #1a1a1a; margin-top: 10px; padding-top: 15px; font-weight: bold; font-size: 18px; }
  .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
  .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e9ecef; }
  .status-badge { display: inline-block; padding: 6px 12px; border-radius: 4px; background: #e8f5e9; color: #2e7d32; font-weight: bold; font-size: 14px; }
`;

const createEmailTemplate = (title, content) => `
  <!DOCTYPE html>
  <html> 
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${emailStyles}</style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} E-commerce Platform. All rights reserved.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
`;

const sendWelcomeEmail = async (user) => {
  try {
    const htmlContent = createEmailTemplate(
      'Welcome to Ecommerce API!',
      `
        <h2 class="greeting">Hello ${user.name},</h2>
        <p class="message">We are thrilled to have you join our community! Your account has been successfully created and you're now ready to start shopping for the best fashion items.</p>
        <p>Here's what you can do now:</p>
        <ul>
          <li>Browse our latest collections</li>
          <li>Save your favorite items to your wishlist</li>
          <li>Track your orders easily</li>
        </ul>
        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || '#'}" class="btn" style="color: #ffffff;">Start Shopping</a>
        </div>
      `
    );

    await sendEmail(
      user.email,
      'Welcome to Ecommerce API!',
      `Welcome ${user.name}! Your account has been successfully created.`,
      htmlContent
    );
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

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

    const itemsHtml = order.items.map(item => `
      <div class="order-row">
        <span>${item.product.name} (x${item.quantity})</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    const htmlContent = createEmailTemplate(
      'Order Confirmation',
      `
        <h2 class="greeting">Thank you for your order, ${order.user.name}!</h2>
        <p class="message">We've received your order and are getting it ready. Here are the details:</p>
        
        <div class="order-summary">
          <div class="order-row" style="border-bottom: 2px solid #ddd; margin-bottom: 10px; padding-bottom: 10px; font-weight: bold;">
            <span>Order #${order.id}</span>
            <span>${new Date(order.created_at).toLocaleDateString()}</span>
          </div>
          ${itemsHtml}
          <div class="order-row total-row">
            <span>Total</span>
            <span>$${order.total_amount.toFixed(2)}</span>
          </div>
        </div>
        
        <p>We'll notify you once your package ships!</p>
      `
    );

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

const sendOrderStatusUpdate = async (orderId, status) => {
  try {
    const order = await sequelize.models.Order.findByPk(orderId, {
      include: [{
        model: sequelize.models.User,
        as: 'user',
        attributes: ['name', 'email']
      }]
    });

    if (!order) return;

    const statusColor = status === 'delivered' ? '#2e7d32' : '#1976d2';
    const statusBg = status === 'delivered' ? '#e8f5e9' : '#e3f2fd';

    const htmlContent = createEmailTemplate(
      'Order Update',
      `
        <h2 class="greeting">Heads up, ${order.user.name}!</h2>
        <p class="message">There has been an update to your order <strong>#${order.id}</strong>.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="font-size: 16px; margin-bottom: 10px;">Current Status:</p>
          <span style="background: ${statusBg}; color: ${statusColor}; padding: 10px 20px; border-radius: 20px; font-weight: bold; font-size: 18px; text-transform: uppercase;">
            ${status}
          </span>
        </div>

        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || '#'}/orders/${order.id}" class="btn" style="color: #ffffff;">View Order Details</a>
        </div>
      `
    );

    await sendEmail(
      order.user.email,
      `Order Update: #${orderId} is ${status}`,
      `Your order #${orderId} status has been updated to: ${status}`,
      htmlContent
    );
  } catch (error) {
    console.error('Error sending order status update:', error);
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

    const htmlContent = createEmailTemplate(
      'Your Order Has Shipped!',
      `
        <h2 class="greeting">Good news, ${order.user.name}!</h2>
        <p class="message">Your order <strong>#${order.id}</strong> is on its way.</p>
        
        <div class="order-summary">
          <p><strong>Carrier:</strong> ${carrier}</p>
          <p><strong>Tracking Number:</strong></p>
          <p style="font-size: 18px; font-family: monospace; background: #fff; padding: 10px; border: 1px solid #ddd; display: inline-block;">${trackingNumber}</p>
        </div>

        <p>You can track your package using the tracking number above.</p>
      `
    );

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

    const admins = await sequelize.models.User.findAll({
      where: { role: 'admin', is_active: true }
    });

    const htmlContent = createEmailTemplate(
      'Low Stock Alert',
      `
        <h2 class="greeting">Inventory Alert</h2>
        <p class="message">The following product is running low on stock:</p>
        
        <div class="order-summary">
          <p><strong>Product:</strong> ${product.name}</p>
          <p><strong>Current Stock:</strong> <span style="color: #d32f2f; font-weight: bold;">${currentStock}</span></p>
          <p><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
        </div>
        
        <p>Please arrange for restocking.</p>
      `
    );

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

    const itemsHtml = cart.items.map(item => `
      <div class="order-row">
        <span>${item.product.name}</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    const htmlContent = createEmailTemplate(
      'Did you forget something?',
      `
        <h2 class="greeting">Hi ${user.name},</h2>
        <p class="message">You left some great items in your cart. They are waiting for you!</p>
        
        <div class="order-summary">
          ${itemsHtml}
          <div class="order-row total-row">
            <span>Total</span>
            <span>$${cart.total_amount.toFixed(2)}</span>
          </div>
        </div>
        
        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || '#'}/cart" class="btn" style="color: #ffffff;">Complete Purchase</a>
        </div>
      `
    );

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

    const productsHtml = promotionData.products && promotionData.products.length > 0 ? `
      <h3>Featured Products</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        ${promotionData.products.map(product => `
          <div style="border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 4px;">
            <strong>${product.name}</strong><br>
            <span style="text-decoration: line-through; color: #888;">$${product.original_price}</span>
            <strong style="color: #e74c3c; display: block; margin-top: 5px;">$${product.discount_price}</strong>
          </div>
        `).join('')}
      </div>
    ` : '';

    const htmlContent = createEmailTemplate(
      promotionData.title,
      `
        <h2 class="greeting">Hi ${user.name},</h2>
        <p class="message">${promotionData.description}</p>
        
        ${productsHtml}
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${promotionData.link || process.env.FRONTEND_URL}" class="btn" style="background-color: #e74c3c; color: #ffffff;">Shop Sale</a>
        </div>
        
        <p style="text-align: center; margin-top: 20px; font-size: 12px; color: #888;">This promotion expires on ${new Date(promotionData.expires_at).toLocaleDateString()}</p>
      `
    );

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
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendShippingNotification,
  sendLowStockAlert,
  sendAbandonedCartReminder,
  sendPromotionalEmail
};