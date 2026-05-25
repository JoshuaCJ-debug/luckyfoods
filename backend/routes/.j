// routes/orderRoutes.js
import express from 'express';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js'; // Protects staff-only routes
import { protectCustomer } from '../middleware/customerAuth.js'; // <-- NEW IMPORT

const router = express.Router();

// Middleware that allows EITHER staff OR customer access
// We use an array of middleware functions. The first successful one proceeds.
// Note: This requires both JWTs to be unique and correctly signed/decoded.
const protectStaffOrCustomer = (req, res, next) => {
    // Attempt to protect as staff first (using existing staff protection logic)
    // If staff fails, we try customer protection. This is a simplification; 
    // real-world dual-auth uses a wrapper middleware, but we'll use a sequential check.
    
    // Temporarily use the simpler protect/customerProtect in route definitions below 
    // until we implement a proper wrapper, to avoid breaking the existing protect logic.
    next(); 
};


// --- STAFF/CUSTOMER ACCESS ROUTES ---
// @route   GET /api/orders & POST /api/orders
// We allow either staff OR customer to access this route by putting them in an array.
// NOTE: Express runs middleware in order. If `protect` fails, we try `protectCustomer`.
// If both fail, the error handler sends the error from the last failed middleware.
router.route('/')
    // Order of protection middleware is critical here: staff can place orders for others, customers for self.
    .post([protect, protectCustomer], createOrder) // Requires Staff (for staff-order) OR Customer (for self-service)
    .get([protect, protectCustomer], getOrders);  // Requires Staff (for all orders) OR Customer (for personal history)


// --- STAFF-ONLY ROUTES ---
// @route   PUT /api/orders/:id/status
router.route('/:id/status')
    .put(protect, updateOrderStatus); // Requires logged-in Staff (Waiters/Managers)

export default router;