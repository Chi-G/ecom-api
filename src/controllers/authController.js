const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { sendWelcomeEmail } = require('../services/notificationService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

const register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  // check if user exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return next(new AppError('User already exists', 400));
  }

  // create user
  const user = await User.create({
    name,
    email,
    password,
  });

  // send welcome email
  try {
    await sendWelcomeEmail(user);
  } catch (err) {
    logger.error('Failed to send welcome email', err);
  }

  logger.info(`User registered: ${email}`);

  res.status(201).json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id),
    },
  });
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // check for user email
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return next(new AppError('Invalid credentials', 401));
  }

  // check if password matches
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new AppError('Invalid credentials', 401));
  }

  // check if user is active
  if (!user.is_active) {
    return next(new AppError('Account is deactivated', 401));
  }

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id),
    },
  });
});

const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password'] }
  });

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.json({
    success: true,
    data: user,
  });
});

module.exports = {
  register,
  login,
  getMe,
};