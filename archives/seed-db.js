require('dotenv').config();
const { sequelize, User, Category, Product } = require('../src/models');

const seedDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected...');

        // sync database without force to preserve structure, but ensure it exists
        await sequelize.sync({ alter: true });

        // 1. ensure Categories exist (handled by sync usually, but good to be sure)
        const categories = [
            { name: 'electronics', description: 'Electronic devices and gadgets' },
            { name: 'clothing', description: 'Apparel and fashion items' },
            { name: 'books', description: 'Books and publications' },
            { name: 'home', description: 'Home and furniture items' },
            { name: 'sports', description: 'Sports and fitness equipment' }
        ];

        for (const cat of categories) {
            await Category.findOrCreate({
                where: { name: cat.name },
                defaults: cat
            });
        }
        console.log('Categories verified/seeded.');

        // 2. create Sample Users
        const users = [
            {
                name: 'Test User',
                email: 'user@example.com',
                password: 'password123',
                role: 'user'
            },
            {
                name: 'Manager User',
                email: 'manager@example.com',
                password: 'password123',
                role: 'admin'
            }
        ];

        for (const userData of users) {
            const existing = await User.findOne({ where: { email: userData.email } });
            if (!existing) {
                await User.create(userData);
                console.log(`User created: ${userData.email}`);
            } else {
                console.log(`User already exists: ${userData.email}`);
            }
        }

        // 3. create Sample Products
        const electronicsCat = await Category.findOne({ where: { name: 'electronics' } });
        const clothingCat = await Category.findOne({ where: { name: 'clothing' } });

        if (electronicsCat && clothingCat) {
            const products = [
                {
                    name: 'Smartphone X',
                    description: 'Latest model smartphone with high res camera',
                    price: 999.99,
                    category_id: electronicsCat.id,
                    stock: 50,
                    brand: 'TechBrand'
                },
                {
                    name: 'Wireless Headphones',
                    description: 'Noise cancelling headphones',
                    price: 199.99,
                    category_id: electronicsCat.id,
                    stock: 100,
                    brand: 'SoundKing'
                },
                {
                    name: 'Classic T-Shirt',
                    description: 'Comfortable cotton t-shirt',
                    price: 29.99,
                    category_id: clothingCat.id,
                    stock: 200,
                    brand: 'FashionCo'
                }
            ];

            for (const prod of products) {
                const existing = await Product.findOne({ where: { name: prod.name } });
                if (!existing) {
                    await Product.create(prod);
                    console.log(`Product created: ${prod.name}`);
                } else {
                    console.log(`Product already exists: ${prod.name}`);
                }
            }
        }

        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedDatabase();
