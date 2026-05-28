// routes/customerRoutes.js - Unified customer management
import express from 'express';
import { 
    createCustomer, 
    getAllCustomers, 
    getCustomerById, 
    updateCustomer, 
    deleteCustomer,
    updateLoyaltyPoints 
} from '../controllers/customerController.js';
import { protect, managerCheck, adminCheck, requireRole } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/customers
// @route   POST /api/customers
// @desc    Get all customers / Create new customer (admin)
// @access  GET: Private/Staff, POST: Private/Admin or Manager
router.route('/')
    .get(protect, requireRole('Waiter'), getAllCustomers)
    .post(protect, managerCheck, createCustomer);

// @route   GET /api/customers/:id
// @route   PUT /api/customers/:id
// @route   DELETE /api/customers/:id
// @desc    Get, update, delete specific customer
// @access  GET: Private (staff or own), PUT: Private (admin/manager or own), DELETE: Private/Admin
router.route('/:id')
    .get(protect, getCustomerById)
    .put(protect, updateCustomer)
    .delete(protect, adminCheck, deleteCustomer);

// @route   PUT /api/customers/:id/loyalty-points
// @desc    Update customer loyalty points
// @access  Private/Manager+
router.put('/:id/loyalty-points', protect, managerCheck, updateLoyaltyPoints);

export default router;
