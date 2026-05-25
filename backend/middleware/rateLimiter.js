// Rate limiting middleware
// Protects API endpoints from abuse by limiting repeated requests

import rateLimit from 'express-rate-limit';

// General API limiter — applies to all routes
export const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX || 100),               // 100 requests per window
    standardHeaders: true,  // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,   // Disable the `X-RateLimit-*` headers
    message: {
        error: true,
        message: 'Too many requests, please try again later.',
    },
});

// Strict limiter for auth routes (login/register) — prevent brute force
export const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 900000), // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || 10),                 // 10 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: true,
        message: 'Too many login/registration attempts. Please try again after 15 minutes.',
    },
    skipSuccessfulRequests: false, // Count all requests, even successful ones
});