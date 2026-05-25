// routes/paymentRoutes.js - Simulated payment processing
import express from 'express';
import { processPayment } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/payments/process
// @desc    Process a simulated payment (3s delay)
// @access  Private
router.post('/process', protect, processPayment);

export default router;