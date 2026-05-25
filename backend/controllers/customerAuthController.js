// controllers/customerAuthController.js
import Customer from '../models/Customer.js';
import jwt from 'jsonwebtoken';

// Utility function to generate JWT for a Customer
const generateCustomerToken = (id, name) => {
    return jwt.sign({ id, name, role: 'Customer' }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register a new customer account
// @route   POST /api/customers/auth/register
// @access  Public
const registerCustomerAccount = async (req, res) => {
    try {
        const { name, contact, password } = req.body;

        if (!name || !password) {
            res.status(400);
            throw new Error('Name and Password are required for registration.');
        }

        const customerExists = await Customer.findOne({ name });

        if (customerExists) {
            res.status(400);
            throw new Error('A customer with this name already exists.');
        }

        const customer = await Customer.create({
            name,
            contact,
            password, // Hashed by Mongoose middleware
            loyaltyPoints: 0,
        });

        if (customer) {
            res.status(201).json({
                _id: customer._id,
                name: customer.name,
                contact: customer.contact,
                loyaltyPoints: customer.loyaltyPoints,
                token: generateCustomerToken(customer._id, customer.name),
            });
        } else {
            res.status(400);
            throw new Error('Invalid customer data');
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message, stack: error.stack });
    }
};

// @desc    Authenticate customer & get token
// @route   POST /api/customers/auth/login
// @access  Public
const loginCustomer = async (req, res) => {
    try {
        const { name, password } = req.body;

        // Find customer by name and select password hash
        const customer = await Customer.findOne({ name }).select('+password');

        if (customer && (await customer.matchPassword(password))) {
            res.json({
                _id: customer._id,
                name: customer.name,
                contact: customer.contact,
                loyaltyPoints: customer.loyaltyPoints,
                token: generateCustomerToken(customer._id, customer.name),
            });
        } else {
            res.status(401); // 401: Unauthorized
            throw new Error('Invalid customer name or password');
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message, stack: error.stack });
    }
};

export { registerCustomerAccount, loginCustomer };
