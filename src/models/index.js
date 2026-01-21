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
const SearchHistory = require('./SearchHistory');

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
Wishlist.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
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
    await sequelize.sync();
    console.log('MySQL tables synchronized successfully.');

    // Seed categories if empty
    const categoryCount = await Category.count();
    if (categoryCount === 0) {
      const categories = [
        { name: 'Electronics', description: 'Gadgets, computers, and electronic devices' },
        { name: 'Fashion', description: 'Clothing, shoes, and accessories' },
        { name: 'Home & Kitchen', description: 'Appliances and home decor' },
        { name: 'Books', description: 'Physical and digital books' },
        { name: 'Sports & Outdoors', description: 'Exercise and outdoor equipment' },
        { name: 'Beauty', description: 'Skincare, makeup, and personal care' },
        { name: 'Health', description: 'Vitamins and wellness products' },
        { name: 'Toys & Games', description: 'Fun for all ages' },
        { name: 'Automotive', description: 'Car parts and accessories' },
        { name: 'Office Supplies', description: 'Paper, pens, and furniture' }
      ];
      await Category.bulkCreate(categories);
      console.log('Categories seeded successfully.');
    }

    // Seed products if empty
    const productCount = await Product.count();
    if (productCount === 0) {
      const allCategories = await Category.findAll();
      const products = [];

      allCategories.forEach(cat => {
        // Create 3 products for each category
        for (let i = 1; i <= 3; i++) {
          products.push({
            name: `${cat.name} Sample Item ${i}`,
            description: `High quality ${cat.name} product. This is a detailed description for testing purposes.`,
            price: Math.floor(Math.random() * 500) + 10.99,
            category_id: cat.id,
            brand: 'TechBrand',
            stock: Math.floor(Math.random() * 100) + 10,
            images: JSON.stringify(['https://via.placeholder.com/400']),
            average_rating: (Math.random() * 2 + 3).toFixed(1),
            rating_count: Math.floor(Math.random() * 50)
          });
        }
      });

      await Product.bulkCreate(products);
      console.log('Products seeded successfully.');
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
  SearchHistory,
  syncDatabase,
  testConnection
};