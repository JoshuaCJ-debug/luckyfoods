// controllers/authController.js - Unified authentication for all users (email + password)
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import Staff from '../models/Staff.js';
import Customer from '../models/Customer.js';

// Utility function to generate JWT
const generateToken = (id, email, role) => {
    return jwt.sign({ id, email, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Unified login for both Staff and Customers using email + password
// @route   POST /api/auth/login
// @access  Public
const unifiedLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Email and password are required');
    }

    // Try to find staff by email
    const staff = await Staff.findOne({ email }).select('+password');

    if (staff && (await staff.matchPassword(password))) {
        res.json({
            _id: staff._id,
            name: staff.name,
            email: staff.email,
            role: staff.role,
            userType: 'staff',
            contact: staff.contact,
            token: generateToken(staff._id, staff.email, staff.role),
        });
        return;
    }

    // Try to find customer by email
    const customer = await Customer.findOne({ email }).select('+password');

    if (customer && (await customer.matchPassword(password))) {
        res.json({
            _id: customer._id,
            name: customer.name,
            email: customer.email,
            role: 'Customer',
            userType: 'customer',
            phone: customer.phone,
            loyaltyPoints: customer.loyaltyPoints,
            token: generateToken(customer._id, customer.email, 'Customer'),
        });
        return;
    }

    res.status(401);
    throw new Error('Invalid email or password');
});

// @desc    Register a new customer account (public signup)
// @route   POST /api/auth/register
// @access  Public
const registerCustomer = asyncHandler(async (req, res) => {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Name, email, and password are required for registration');
    }

    // Check if customer exists by email
    const customerExists = await Customer.findOne({ email });
    if (customerExists) {
        res.status(400);
        throw new Error('A customer with this email already exists');
    }

    // Check if staff exists with this email
    const staffExists = await Staff.findOne({ email });
    if (staffExists) {
        res.status(400);
        throw new Error('This email is already taken by a staff member');
    }

    const customer = await Customer.create({
        name,
        email,
        phone,
        password,
        loyaltyPoints: 0,
    });

    res.status(201).json({
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        role: 'Customer',
        userType: 'customer',
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        token: generateToken(customer._id, customer.email, 'Customer'),
    });
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    // The protect middleware sets either req.staff or req.customer
    if (req.staff) {
        res.json({
            _id: req.staff._id,
            name: req.staff.name,
            email: req.staff.email,
            role: req.staff.role,
            userType: 'staff',
            contact: req.staff.contact,
        });
    } else if (req.customer) {
        res.json({
            _id: req.customer._id,
            name: req.customer.name,
            email: req.customer.email,
            role: 'Customer',
            userType: 'customer',
            phone: req.customer.phone,
            loyaltyPoints: req.customer.loyaltyPoints,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

export { unifiedLogin, registerCustomer, getUserProfile, generateToken };