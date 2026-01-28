const { Product, Category } = require('../models');
const APIFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Helper to handle category logic since APIFeatures is generic
const handleCategoryFilter = async (query) => {
  if (query.category) {
    const categoryRecord = await Category.findOne({ where: { name: query.category } });
    if (categoryRecord) {
      return { category_id: categoryRecord.id };
    }
  }
  return {};
};

const getProducts = catchAsync(async (req, res, next) => {
  // Initialize features with req.query
  const features = new APIFeatures(req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Add specific Category logic
  const categoryFilter = await handleCategoryFilter(req.query);

  // Merge generic where options with category specific one and active check
  const whereOptions = {
    ...features.options.where,
    ...categoryFilter,
    is_active: true
  };

  features.options.where = whereOptions;

  // Execute query
  const { count, rows: products } = await Product.findAndCountAll({
    ...features.options,
    include: [{
      model: Category,
      as: 'category',
      attributes: ['id', 'name']
    }],
    distinct: true
  });

  res.json({
    success: true,
    data: products,
    pagination: {
      currentPage: features.page,
      totalPages: Math.ceil(count / features.limit),
      totalItems: count,
      itemsPerPage: features.limit,
    },
  });
});

const getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findOne({
    where: { id: req.params.id, is_active: true },
    include: [{
      model: Category,
      as: 'category',
      attributes: ['id', 'name']
    }]
  });

  if (!product) {
    return next(new AppError('Product not found top', 404));
  }

  res.json({
    success: true,
    data: product,
  });
});

const createProduct = catchAsync(async (req, res, next) => {
  const product = await Product.create(req.body);

  res.status(201).json({
    success: true,
    data: product,
  });
});

const updateProduct = catchAsync(async (req, res, next) => {
  const [updatedRows] = await Product.update(req.body, {
    where: { id: req.params.id, is_active: true }
  });

  if (updatedRows === 0) {
    return next(new AppError('Product not found', 404));
  }

  const product = await Product.findByPk(req.params.id, {
    include: [{
      model: Category,
      as: 'category',
      attributes: ['id', 'name']
    }]
  });

  res.json({
    success: true,
    data: product,
  });
});

const deleteProduct = catchAsync(async (req, res, next) => {
  const [updatedRows] = await Product.update(
    { is_active: false },
    { where: { id: req.params.id, is_active: true } }
  );

  if (updatedRows === 0) {
    return next(new AppError('Product not found', 404));
  }

  res.json({
    success: true,
    message: 'Product deleted successfully',
  });
});

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};