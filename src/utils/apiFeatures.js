const { Op } = require('sequelize');

class APIFeatures {
    constructor(query, queryString) {
        this.query = query; // expect req.query
        this.options = {
            where: {},
            order: [],
        };
    }

    filter() {
        const queryObj = { ...this.query };
        const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
        excludedFields.forEach(el => delete queryObj[el]);

        Object.keys(queryObj).forEach(key => {
            if (key === 'is_active') return; // handled by default or caller

            let value = queryObj[key];

            if (typeof value === 'object' && value !== null) {
                // Handle nested operators like price[gte]
                const operators = {};
                Object.keys(value).forEach(op => {
                    if (Op[op]) {
                        operators[Op[op]] = value[op];
                    }
                });
                if (Object.keys(operators).length > 0) {
                    this.options.where[key] = operators;
                }
            } else {
                // Simple equality
                this.options.where[key] = value;
            }
        });

        return this;
    }

    sort() {
        if (this.query.sort) {
            // ?sort=-price,name
            const sortBy = this.query.sort.split(',').map(field => {
                if (field.startsWith('-')) {
                    return [field.substring(1), 'DESC'];
                }
                return [field, 'ASC'];
            });
            this.options.order = sortBy;
        } else {
            this.options.order = [['created_at', 'DESC']];
        }
        return this;
    }

    limitFields() {
        if (this.query.fields) {
            this.options.attributes = this.query.fields.split(',');
        }
        return this;
    }

    paginate() {
        const page = this.query.page * 1 || 1;
        const limit = this.query.limit * 1 || 10;
        const offset = (page - 1) * limit;

        this.options.limit = limit;
        this.options.offset = offset;
        this.page = page;
        this.limit = limit;

        return this;
    }
}

module.exports = APIFeatures;