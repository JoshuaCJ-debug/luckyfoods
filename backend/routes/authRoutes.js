// routes/authRoutes.js - Unified authentication routes
import express from 'express';
import { unifiedLogin, registerCustomer, getUserProfile } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Unified login for Staff and Customers
// @access  Public (with strict rate limiting)
router.post('/login', authLimiter, unifiedLogin);

// @route   POST /api/auth/register
// @desc    Register a new customer
// @access  Public (with strict rate limiting)
router.post('/register', authLimiter, registerCustomer);

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, getUserProfile);

export default router;