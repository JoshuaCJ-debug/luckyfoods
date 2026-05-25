// routes/customerAuthRoutes.js
import express from 'express';
import { registerCustomerAccount, loginCustomer } from '../controllers/customerAuthController.js';

const router = express.Router();

// Public routes for customer authentication
router.post('/register', registerCustomerAccount);
router.post('/login', loginCustomer);

export default router;