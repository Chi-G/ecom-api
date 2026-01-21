const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SearchHistory = sequelize.define('SearchHistory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    query: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            len: [1, 255]
        }
    },
    search_count: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
    },
    last_searched_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'search_history',
    indexes: [
        {
            unique: true,
            fields: ['query']
        },
        {
            fields: ['search_count']
        },
        {
            fields: ['last_searched_at']
        }
    ]
});

module.exports = SearchHistory;
