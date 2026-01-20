require('dotenv').config();
const { sequelize } = require('../src/config/database');

async function fixIndexes() {
    try {
        const tables = ['users', 'categories'];

        for (const table of tables) {
            console.log(`\nChecking table: ${table}`);
            const [results] = await sequelize.query(`SHOW INDEX FROM ${table}`);

            const duplicateIndexes = results
                .filter(idx => idx.Key_name.match(/_(?:\d+)$/))
                .map(idx => idx.Key_name);

            console.log(`Found ${duplicateIndexes.length} duplicate indexes to remove from ${table}.`);

            for (const indexName of duplicateIndexes) {
                console.log(`Dropping index: ${indexName}`);
                await sequelize.query(`DROP INDEX ${indexName} ON ${table}`);
            }
        }

        console.log('\nCleanup complete.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

fixIndexes();
