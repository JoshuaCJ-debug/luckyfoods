// middleware/auth.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import Staff from '../models/staff.js';
import Customer from '../models/Customer.js';

// Middleware to ensure a user is logged in
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check for the token in the request headers
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header (Format: 'Bearer <token>')
            token = req.headers.authorization.split(' ')[1];

            // Verify token using the secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.role === 'Customer') {
                const customer = await Customer.findById(decoded.id).select('-password');
                if (!customer) {
                    res.status(401);
                    throw new Error('Not authorized, customer not found');
                }
                req.customer = customer;
                req.user = customer;
                req.userRole = 'Customer';
            } else {
                const staff = await Staff.findById(decoded.id).select('-password');
                if (!staff) {
                    res.status(401);
                    throw new Error('Not authorized, staff member not found');
                }
                req.staff = staff;
                req.user = staff;
                req.userRole = staff.role;
            }

            next();
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

// RBAC Hierarchy: Admin > Manager > Waiter > Customer
const roleHierarchy = {
    'Admin': 4,
    'Manager': 3,
    'Waiter': 2,
    'Customer': 1,
};

// Middleware to check if user has required role or higher
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user || !req.userRole) {
            res.status(401);
            throw new Error('Not authenticated');
        }

        const userRoleLevel = roleHierarchy[req.userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        if (userRoleLevel >= requiredLevel) {
            next();
        } else {
            res.status(403);
            throw new Error(`Not authorized. Required role: ${requiredRole} or higher`);
        }
    };
};

// Middleware to restrict access to Managers or higher
const managerCheck = (req, res, next) => {
    if (!req.staff || !req.staff.role) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const userLevel = roleHierarchy[req.staff.role] || 0;
    const managerLevel = roleHierarchy['Manager'] || 0;

    if (userLevel >= managerLevel) {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized as Manager or higher');
    }
};

// Middleware to restrict access to Admins only
const adminCheck = (req, res, next) => {
    if (!req.staff || req.staff.role !== 'Admin') {
        res.status(403);
        throw new Error('Not authorized. Admin access required');
    }
    next();
};

export { protect, requireRole, managerCheck, adminCheck, roleHierarchy };
