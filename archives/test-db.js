const sequelize = require('../src/config/mysql');

const testConnection = async () => {
    console.log('Testing connection with:');
    console.log('Database:', process.env.DB_NAME);
    console.log('User:', process.env.DB_USER);
    console.log('Host:', process.env.DB_HOST);

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};

testConnection();
