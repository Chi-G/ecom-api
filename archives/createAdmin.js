const bcrypt = require('bcryptjs');
require('dotenv').config();

const { User, sequelize } = require('../src/models');

const createAdmin = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');

    // ensure tables exist before trying to query them
    await sequelize.sync();

    const adminData = {
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin'
    };

    const existingAdmin = await User.findOne({ where: { email: adminData.email } });
    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit(0);
    }

    // note: User model hook handles password hashing
    const admin = await User.create(adminData);

    console.log('Admin created:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();