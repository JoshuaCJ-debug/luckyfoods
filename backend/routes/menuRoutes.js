// routes/menuRoutes.js - Menu management with RBAC
import express from 'express';
import { getMenu, updateMenuItem, createMenuItem, deleteMenuItem } from '../controllers/menuController.js';
// Only import protect and managerCheck where they're used (POST/PUT/DELETE)
import { protect, managerCheck } from '../middleware/auth.js';

const router = express.Router();

// Simple test endpoint - completely public with no dependencies
router.get('/test-public', (req, res) => {
    res.json({ message: 'This endpoint is completely public and should work without authentication' });
});

// @route   GET /api/menu
// @desc    Get the entire current menu
// @access  Public (no login required — guests browse the menu)
router.get('/', getMenu);

// @route   POST /api/menu/:collection
// @desc    Create a new menu item
// @access  Private (Manager or Admin only)
router.post('/:collection', protect, managerCheck, createMenuItem);      

// @route   PUT /api/menu/:collection/:id
// @desc    Update price of a menu item
// @access  Private (Manager or Admin only)
router.put('/:collection/:id', protect, managerCheck, updateMenuItem);   

// @route   DELETE /api/menu/:collection/:id
// @desc    Delete a menu item
// @access  Private (Manager or Admin only)
router.delete('/:collection/:id', protect, managerCheck, deleteMenuItem);

export default router;
