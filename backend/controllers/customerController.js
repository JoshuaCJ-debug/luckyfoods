// controllers/customerController.js - Customer management with admin capabilities
import asyncHandler from 'express-async-handler';
import Customer from '../models/Customer.js';

// @desc    Create a new customer (Admin/Manager only)
// @route   POST /api/customers
// @access  Private/Admin or Manager
const createCustomer = asyncHandler(async (req, res) => {
    const { name, email, phone, loyaltyPoints } = req.body;

    if (!name || !email) {
        res.status(400);
        throw new Error('Name and email are required');
    }

    // Check if customer exists by email
    const customerExists = await Customer.findOne({ email });
    if (customerExists) {
        res.status(400);
        throw new Error('Customer with this email already exists');
    }

    const customer = await Customer.create({
        name,
        email,
        phone,
        loyaltyPoints: loyaltyPoints || 0,
        // Note: password is optional when created by admin, can be set later
        password: process.env.DEFAULT_TEMP_PASSWORD || 'TempPassword123!', // Temporary password, should be changed by customer
    });

    res.status(201).json({
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        loyaltyPoints: customer.loyaltyPoints,
        message: 'Customer created. Please change the temporary password.',
    });
});

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private/Staff
const getAllCustomers = asyncHandler(async (req, res) => {
    const customers = await Customer.find({})
        .select('-password')
        .sort({ name: 1 });

    res.json(customers);
});

// @desc    Get customer by ID
// @route   GET /api/customers/:id
// @access  Private/Staff or Customer (own data)
const getCustomerById = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id).select('-password');

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Customers can only view their own profile unless they're staff
    if (req.customer && req.customer._id.toString() !== req.params.id && !req.staff) {
        res.status(403);
        throw new Error('Not authorized to view this customer');
    }

    res.json(customer);
});

// @desc    Update customer details
// @route   PUT /api/customers/:id
// @access  Private (Admin/Manager or customer own profile)
const updateCustomer = asyncHandler(async (req, res) => {
    const { name, email, phone, loyaltyPoints } = req.body;
    const customerId = req.params.id;

    const customer = await Customer.findById(customerId);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Customers can only update their own profile
    if (req.customer && req.customer._id.toString() !== customerId && !req.staff) {
        res.status(403);
        throw new Error('You can only update your own profile');
    }

    // Check if new email is unique
    if (email && email !== customer.email) {
        const emailExists = await Customer.findOne({ email });
        if (emailExists) {
            res.status(400);
            throw new Error('This email is already in use');
        }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
        customerId,
        {
            ...(name && { name }),
            ...(email && { email }),
            ...(phone && { phone }),
            ...(loyaltyPoints !== undefined && req.staff && { loyaltyPoints }), // Only staff can update loyalty points
        },
        { new: true, runValidators: true }
    ).select('-password');

    res.json(updatedCustomer);
});

// @desc    Delete a customer (Admin only)
// @route   DELETE /api/customers/:id
// @access  Private/Admin
const deleteCustomer = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    await Customer.findByIdAndDelete(req.params.id);

    res.json({ message: 'Customer deleted successfully' });
});

// @desc    Add loyalty points to a customer (Manager/Admin only)
// @route   PUT /api/customers/:id/loyalty-points
// @access  Private/Manager+
const updateLoyaltyPoints = asyncHandler(async (req, res) => {
    const { pointsToAdd } = req.body;

    if (pointsToAdd === undefined) {
        res.status(400);
        throw new Error('Points to add is required');
    }

    const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        { 
            $inc: { loyaltyPoints: pointsToAdd }
        },
        { new: true, runValidators: true }
    ).select('-password');

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    res.json(customer);
});

export { 
    createCustomer, 
    getAllCustomers, 
    getCustomerById, 
    updateCustomer, 
    deleteCustomer,
    updateLoyaltyPoints 
};
