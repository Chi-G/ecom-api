require('dotenv').config();
const { sequelize } = require('../src/config/database');

async function checkIndexes() {
    try {
        const [results] = await sequelize.query("SHOW INDEX FROM users");
        console.log('Indexes on users table:');
        results.forEach(idx => {
            console.log(`- ${idx.Key_name} (Column: ${idx.Column_name})`);
        });
        console.log(`\nTotal indexes: ${results.length}`);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

checkIndexes();
