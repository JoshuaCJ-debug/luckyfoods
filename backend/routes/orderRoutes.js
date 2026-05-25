// routes/orderRoutes.js - Order management with role-based access
import express from 'express';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/orders
// @route   POST /api/orders
// @desc    Get all orders / Create new order (staff or customer)
// @access  Private (Staff see all, Customers see own)
router.route('/')
    .post(protect, createOrder)
    .get(protect, getOrders);

// @route   PUT /api/orders/:id/status
// @desc    Update order status (staff only)
// @access  Private (Staff)
router.put('/:id/status', protect, updateOrderStatus);

export default router;
