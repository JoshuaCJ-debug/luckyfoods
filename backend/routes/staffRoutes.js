// routes/staffRoutes.js - Unified staff management
import express from 'express';
import { 
    createStaff, 
    getStaffMembers, 
    getStaffById, 
    updateStaff, 
    deleteStaff,
    changeStaffRole 
} from '../controllers/staffController.js';
import { protect, managerCheck, adminCheck } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/staff
// @route   POST /api/staff
// @desc    Get all staff / Create new staff member
// @access  GET: Private/Manager+, POST: Private/Admin only
router.route('/')
    .get(protect, managerCheck, getStaffMembers)
    .post(protect, adminCheck, createStaff);

// @route   GET /api/staff/:id
// @route   PUT /api/staff/:id
// @route   DELETE /api/staff/:id
// @desc    Get, update, delete specific staff member
// @access  GET: Private/Manager+, PUT: Private/Admin (or own profile), DELETE: Private/Admin
router.route('/:id')
    .get(protect, managerCheck, getStaffById)
    .put(protect, updateStaff)
    .delete(protect, adminCheck, deleteStaff);

// @route   POST /api/staff/:id/change-role
// @desc    Change staff member role (promote/demote)
// @access  Private/Admin only
router.post('/:id/change-role', protect, adminCheck, changeStaffRole);

export default router;