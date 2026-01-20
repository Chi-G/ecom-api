const { sequelize, testConnection } = require('../config/database');
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Cart = require('./Cart');
const CartItem = require('./CartItem');
const Wishlist = require('./Wishlist');
const Review = require('./Review');
const Address = require('./Address');
const Payment = require('./Payment');

// define associations
User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Cart Associations
User.hasOne(Cart, { foreignKey: 'user_id', as: 'cart' });
Cart.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Cart.hasMany(CartItem, { foreignKey: 'cart_id', as: 'items' });
CartItem.belongsTo(Cart, { foreignKey: 'cart_id', as: 'cart' });

CartItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(CartItem, { foreignKey: 'product_id', as: 'cartItems' });

// Wishlist Associations
User.belongsToMany(Product, { through: Wishlist, foreignKey: 'user_id', as: 'wishlist' });
Product.belongsToMany(User, { through: Wishlist, foreignKey: 'product_id', as: 'wishlistedBy' });
Wishlist.belongsTo(Product, { foreignKey: 'product_id', as: 'product' }); // Direct access if needed
Wishlist.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Review Associations
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Product.hasMany(Review, { foreignKey: 'product_id', as: 'reviews' });
Review.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Address Associations
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Payment Associations
Order.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });
Payment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('MySQL tables synchronized successfully.');

    // seed categories if empty
    const categoryCount = await Category.count();
    if (categoryCount === 0) {
      const categories = [
        { name: 'electronics', description: 'Electronic devices and gadgets' },
        { name: 'clothing', description: 'Apparel and fashion items' },
        { name: 'books', description: 'Books and publications' },
        { name: 'home', description: 'Home and furniture items' },
        { name: 'sports', description: 'Sports and fitness equipment' },
        { name: 'other', description: 'Other miscellaneous items' }
      ];
      await Category.bulkCreate(categories);
      console.log('Categories seeded successfully.');
    }
  } catch (error) {
    console.error('Database synchronization failed:', error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Order,
  OrderItem,
  Cart,
  CartItem,
  Wishlist,
  Review,
  Address,
  Payment,
  syncDatabase,
  testConnection
};