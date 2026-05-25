// middleware/customerAuth.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import Customer from '../models/Customer.js';

// Middleware to ensure a user is logged in as a Customer
const protectCustomer = asyncHandler(async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch the Customer data from the database
            // We attach the customer to the request object (req.customer)
            req.customer = await Customer.findById(decoded.id).select('-password');

            if (!req.customer) {
                res.status(401);
                throw new Error('Not authorized, customer not found');
            }

            next();
        } catch (error) {
            console.error('Customer Token verification error:', error.message);
            res.status(401);
            throw new Error('Not authorized, invalid customer token');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided');
    }
});

export { protectCustomer };