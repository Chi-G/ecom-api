const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

// Rate limiting configurations
const createRateLimiters = () => {
    return {
        // Strict rate limiting for auth endpoints
        authLimiter: rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            message: 'Too many authentication attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
        }),

        // General API rate limiting
        apiLimiter: rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many requests from this IP, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
        }),

        // Payment endpoints - very strict
        paymentLimiter: rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10,
            message: 'Too many payment attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false,
        }),

        // Slow down middleware for repeated requests
        speedLimiter: slowDown({
            windowMs: 15 * 60 * 1000,
            delayAfter: 50,
            delayMs: (used, req) => {
                const delayAfter = req.slowDown.limit;
                return (used - delayAfter) * 500;
            },
            maxDelayMs: 20000,
        }),
    };
};

// Advanced input validation
const validateInput = (type) => {
    switch (type) {
        case 'email':
            return body('email')
                .isEmail()
                .normalizeEmail()
                .isLength({ max: 100 })
                .withMessage('Please provide a valid email address');

        case 'password':
            return body('password')
                .isLength({ min: 8 })
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
                .withMessage('Password must be at least 8 characters long and contain uppercase, lowercase, number and special character');

        case 'phone':
            return body('phone')
                .optional()
                .matches(/^\+?[\d\s\-\(\)]+$/)
                .isLength({ min: 10, max: 15 })
                .withMessage('Please provide a valid phone number');

        case 'credit_card':
            return [
                body('card_number')
                    .matches(/^\d{16}$/)
                    .withMessage('Card number must be 16 digits'),
                body('expiry_month')
                    .isInt({ min: 1, max: 12 })
                    .withMessage('Expiry month must be between 01 and 12'),
                body('expiry_year')
                    .isInt({ min: new Date().getFullYear(), max: new Date().getFullYear() + 10 })
                    .withMessage('Expiry year must be valid'),
                body('cvv')
                    .matches(/^\d{3,4}$/)
                    .withMessage('CVV must be 3 or 4 digits')
            ];

        default:
            return (req, res, next) => next();
    }
};

// Sanitize input data
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].trim();
                obj[key] = obj[key].replace(/[<>\"'%;()&+]/g, '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    };

    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);

    next();
};

// API key validation
const validateApiKey = (req, res, next) => {
    const apiKey = req.header('X-API-Key');

    if (!apiKey) {
        return res.status(401).json({ message: 'API key required' });
    }

    // In production, validate against database
    const validApiKeys = process.env.API_KEYS?.split(',') || [];

    if (!validApiKeys.includes(apiKey)) {
        return res.status(401).json({ message: 'Invalid API key' });
    }

    next();
};

// Content Security Policy
const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
    const suspiciousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /union\s+select/gi,
        /drop\s+table/gi,
        /exec\s*\(/gi,
        /xp_/gi
    ];

    const checkSuspicious = (data) => {
        if (!data || typeof data !== 'string') return false;

        return suspiciousPatterns.some(pattern => pattern.test(data.toLowerCase()));
    };

    const isSuspicious =
        checkSuspicious(req.body) ||
        checkSuspicious(req.query) ||
        checkSuspicious(req.params) ||
        checkSuspicious(req.headers['user-agent']);

    if (isSuspicious) {
        console.warn(`Suspicious request detected from IP: ${req.ip}`);
        console.warn(`Method: ${req.method}, URL: ${req.originalUrl}`);
        console.warn(`User-Agent: ${req.headers['user-agent']}`);

        // Block the request
        return res.status(403).json({ message: 'Request blocked due to security policy' });
    }

    next();
};

module.exports = {
    createRateLimiters,
    validateInput,
    sanitizeInput,
    validateApiKey,
    securityHeaders,
    securityLogger
};