const { Product, Category, Review } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const redis = require('../config/redis');

const searchProducts = async (req, res, next) => {
  try {
    const {
      q: query = '',
      category,
      minPrice,
      maxPrice,
      minRating,
      brand,
      inStock,
      sortBy = 'relevance',
      sortOrder = 'DESC',
      page = 1,
      limit = 20
    } = req.query;

    // Create cache key
    const cacheKey = `search:${JSON.stringify(req.query)}`;

    // Check cache first
    const cachedResults = await redis.get(cacheKey);
    if (cachedResults) {
      return res.json({
        success: true,
        data: JSON.parse(cachedResults),
        cached: true
      });
    }

    const whereClause = { is_active: true };
    const havingClause = {};

    // Text search
    if (query) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${query}%` } },
        { description: { [Op.like]: `%${query}%` } },
        { brand: { [Op.like]: `%${query}%` } }
      ];
    }

    // Category filter
    if (category) {
      const categories = await Category.findAll({
        where: {
          [Op.or]: [
            { id: category },
            { name: { [Op.like]: `%${category}%` } }
          ]
        }
      });

      if (categories.length > 0) {
        whereClause.category_id = {
          [Op.in]: categories.map(c => c.id)
        };
      }
    }

    // Price range
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price[Op.gte] = minPrice;
      if (maxPrice) whereClause.price[Op.lte] = maxPrice;
    }

    // Brand filter
    if (brand) {
      whereClause.brand = { [Op.like]: `%${brand}%` };
    }

    // Stock filter
    if (inStock === 'true') {
      whereClause.stock = { [Op.gt]: 0 };
    }

    // Rating filter
    if (minRating) {
      havingClause.avg_rating = { [Op.gte]: minRating };
    }

    // Sorting options
    let order = [];
    switch (sortBy) {
      case 'price_low':
        order = [['price', 'ASC']];
        break;
      case 'price_high':
        order = [['price', 'DESC']];
        break;
      case 'rating':
        order = [[literal('avg_rating'), 'DESC']];
        break;
      case 'newest':
        order = [['created_at', 'DESC']];
        break;
      case 'popularity':
        order = [[literal('total_sold'), 'DESC']];
        break;
      default: // relevance
        order = [[literal('MATCH(name, description) AGAINST(:query)'), 'DESC']];
    }

    // Build the query
    const queryOptions = {
      where: whereClause,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        },
        {
          model: Review,
          as: 'reviews',
          where: { is_active: true },
          required: false,
          attributes: []
        }
      ],
      attributes: {
        include: [
          [fn('AVG', col('reviews.rating')), 'avg_rating'],
          [fn('COUNT', col('reviews.id')), 'review_count'],
          [literal(`(
            SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = Product.id
            AND o.status IN ('delivered', 'completed')
          )`), 'total_sold']
        ]
      },
      group: ['Product.id', 'category.id'],
      having: havingClause,
      order,
      limit: parseInt(limit),
      offset: (page - 1) * limit
    };

    // Execute search
    const { count, rows: products } = await Product.findAndCountAll(queryOptions);

    // Get filters data for sidebar
    const [categories, brands, priceRange] = await Promise.all([
      Category.findAll({
        where: { is_active: true },
        include: [{
          model: Product,
          as: 'products',
          where: whereClause,
          required: false,
          attributes: []
        }],
        attributes: {
          include: [[fn('COUNT', col('products.id')), 'product_count']]
        },
        group: ['Category.id'],
        having: literal('product_count > 0')
      }),

      Product.findAll({
        where: whereClause,
        attributes: [
          [fn('DISTINCT', col('brand')), 'brand'],
          [fn('COUNT', col('id')), 'count']
        ],
        group: ['brand'],
        having: literal('brand IS NOT NULL'),
        order: [[literal('count'), 'DESC']],
        limit: 20
      }),

      Product.findOne({
        where: whereClause,
        attributes: [
          [fn('MIN', col('price')), 'min_price'],
          [fn('MAX', col('price')), 'max_price']
        ]
      })
    ]);

    const results = {
      products,
      filters: {
        categories: categories.filter(c => c.dataValues.product_count > 0),
        brands: brands.filter(b => b.dataValues.brand),
        price_range: {
          min: priceRange?.dataValues.min_price || 0,
          max: priceRange?.dataValues.max_price || 0
        }
      },
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(count.length / limit),
        total_items: count.length,
        items_per_page: parseInt(limit)
      },
      search_info: {
        query,
        results_count: count.length,
        executed_filters: {
          category,
          minPrice,
          maxPrice,
          minRating,
          brand,
          inStock
        }
      }
    };

    // Cache results for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(results));

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get suggestions from products
    const products = await Product.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { brand: { [Op.like]: `%${query}%` } }
        ],
        is_active: true
      },
      attributes: ['name', 'brand'],
      limit: 8,
      group: ['name', 'brand']
    });

    // Get suggestions from categories
    const categories = await Category.findAll({
      where: {
        name: { [Op.like]: `%${query}%` },
        is_active: true
      },
      attributes: ['name'],
      limit: 5
    });

    // Combine and format suggestions
    const suggestions = [
      ...products.map(p => p.name),
      ...products.map(p => p.brand).filter(Boolean),
      ...categories.map(c => c.name)
    ].filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 10);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

const getPopularSearches = async (req, res, next) => {
  try {
    // Get popular searches from cache or database
    const popularSearches = await redis.zrevrange('popular_searches', 0, 9, 'WITHSCORES');

    const searches = [];
    for (let i = 0; i < popularSearches.length; i += 2) {
      searches.push({
        term: popularSearches[i],
        count: parseInt(popularSearches[i + 1])
      });
    }

    res.json({
      success: true,
      data: searches
    });
  } catch (error) {
    next(error);
  }
};

const trackSearch = async (req, res, next) => {
  try {
    const { query } = req.body;

    if (query && query.length > 2) {
      // Increment search counter in Redis
      await redis.zincrby('popular_searches', 1, query.toLowerCase());

      // Keep only top 100 searches
      await redis.zremrangebyrank('popular_searches', 0, -101);
    }

    res.json({
      success: true,
      message: 'Search tracked'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchProducts,
  getSearchSuggestions,
  getPopularSearches,
  trackSearch
};