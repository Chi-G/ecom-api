const { Product, Category, Review, SearchHistory } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

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
      default:
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
      // Group by all columns used in attributes to satisfy ONLY_FULL_GROUP_BY
      group: [
        'Product.id',
        'Product.name',
        'Product.description',
        'Product.price',
        'Product.category_id',
        'Product.brand',
        'Product.stock',
        'Product.images',
        'Product.average_rating',
        'Product.rating_count',
        'Product.is_active',
        'Product.created_at',
        'Product.updated_at',
        'category.id',
        'category.name'
      ],
      having: havingClause,
      order,
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      replacements: { query }, // Pass query to literal MATCH AGAINST
      subQuery: false // Prevent issues with group by in subqueries
    };

    // Execute search
    const { count, rows: products } = await Product.findAndCountAll(queryOptions);

    // Get total count (findAndCountAll with group returns an array of counts)
    const totalItems = Array.isArray(count) ? count.length : count;

    // Get filters data for sidebar
    const [sidebarCategories, sidebarBrands, priceRange] = await Promise.all([
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
        categories: sidebarCategories.filter(c => c.dataValues.product_count > 0),
        brands: sidebarBrands.filter(b => b.dataValues.brand),
        price_range: {
          min: priceRange?.dataValues.min_price || 0,
          max: priceRange?.dataValues.max_price || 0
        }
      },
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(totalItems / limit),
        total_items: totalItems,
        items_per_page: parseInt(limit)
      },
      search_info: {
        query,
        results_count: totalItems,
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
    // Get top 10 most searched queries from MySQL
    const popularSearches = await SearchHistory.findAll({
      attributes: [
        'query',
        ['search_count', 'count'],
        'last_searched_at'
      ],
      order: [['search_count', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      data: popularSearches.map(search => ({
        term: search.query,
        count: search.search_count,
        last_searched: search.last_searched_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

const trackSearch = async (req, res, next) => {
  try {
    const { query } = req.body;

    if (!query || query.length < 2) {
      return res.json({
        success: false,
        message: 'Query too short to track'
      });
    }

    const normalizedQuery = query.toLowerCase().trim();

    // Find existing search or create new one
    const [searchRecord, created] = await SearchHistory.findOrCreate({
      where: { query: normalizedQuery },
      defaults: {
        query: normalizedQuery,
        search_count: 1,
        last_searched_at: new Date()
      }
    });

    // If record exists, increment count and update timestamp
    if (!created) {
      await searchRecord.increment('search_count');
      await searchRecord.update({ last_searched_at: new Date() });
    }

    // Keep only top 100 searches (cleanup old/unpopular ones)
    const totalSearches = await SearchHistory.count();
    if (totalSearches > 100) {
      const topSearches = await SearchHistory.findAll({
        attributes: ['id'],
        order: [['search_count', 'DESC']],
        limit: 100
      });

      const topIds = topSearches.map(s => s.id);
      await SearchHistory.destroy({
        where: {
          id: { [Op.notIn]: topIds }
        }
      });
    }

    res.json({
      success: true,
      message: 'Search tracked',
      data: {
        query: normalizedQuery,
        total_searches: created ? 1 : searchRecord.search_count + 1
      }
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