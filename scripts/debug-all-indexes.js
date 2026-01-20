require('dotenv').config();
const { sequelize } = require('../src/config/database');

async function checkAllIndexes() {
    try {
        const tables = ['users', 'categories', 'products', 'orders', 'order_items'];

        for (const table of tables) {
            console.log(`\n--- Indexes on ${table} table ---`);
            try {
                const [results] = await sequelize.query(`SHOW INDEX FROM ${table}`);
                results.forEach(idx => {
                    console.log(`- ${idx.Key_name} (Column: ${idx.Column_name})`);
                });
                console.log(`Total indexes: ${results.length}`);
            } catch (err) {
                console.log(`Could not check ${table}: ${err.message}`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

checkAllIndexes();
