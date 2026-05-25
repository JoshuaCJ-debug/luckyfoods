import asyncHandler from 'express-async-handler';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';

// --- LOYALTY POINT CONFIGURATION ---
const POINTS_PER_UGX = 1 / 1000;

// @desc    Create a new order (Staff or Customer)
// @route   POST /api/orders
// @access  Private (Staff OR Customer)
const createOrder = asyncHandler(async (req, res) => {
    const { items, totalAmount, customerId } = req.body;

    // --- DETERMINE SOURCE OF ORDER AND CUSTOMER INFO ---
    let actualCustomerId, servedBy;

    if (req.staff) {
        // Source 1: Staff placing an order for a customer
        if (!customerId) {
            res.status(400);
            throw new Error('Customer ID is required when staff places order');
        }
        actualCustomerId = customerId;
        servedBy = req.staff.name; // Staff member's name
    } else if (req.customer) {
        // Source 2: Customer placing a self-service order
        actualCustomerId = req.customer._id;
        servedBy = 'Self-Service';
    } else {
        res.status(401);
        throw new Error('Not authorized to place order.');
    }

    if (!items || items.length === 0 || !totalAmount) {
        res.status(400);
        throw new Error('Order must contain items and total amount.');
    }

    // Verify customer exists
    const customer = await Customer.findById(actualCustomerId);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // --- CORE LOGIC: ORDER CREATION ---
    const order = await Order.create({
        customerId: actualCustomerId,
        customerName: customer.name,
        servedBy,
        items,
        totalAmount,
        status: 'Pending',
        orderTime: new Date()
    });

    // --- LOYALTY POINT INTEGRATION ---
    // Only award points when there is a meaningful amount to convert into points.
    let loyaltyUpdateMessage = null;
    let loyaltyResponse = null;

    try {
        const pointsEarned = Math.floor(totalAmount * POINTS_PER_UGX);
        if (pointsEarned > 0) {
            customer.loyaltyPoints = (customer.loyaltyPoints || 0) + pointsEarned;
            await customer.save();
            loyaltyUpdateMessage = `Added ${pointsEarned} points. New total: ${customer.loyaltyPoints}`;
            loyaltyResponse = { pointsEarned, totalPoints: customer.loyaltyPoints };
        } else {
            // Do not record or display zero-point updates
            loyaltyUpdateMessage = null;
            loyaltyResponse = null;
        }
    } catch (error) {
        console.error("Loyalty update failed:", error.message);
        loyaltyUpdateMessage = "Order placed, but loyalty update failed due to a server error.";
    }

    res.status(201).json({
        order,
        loyalty: loyaltyResponse,
        loyaltyUpdate: loyaltyUpdateMessage
    });
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Staff see all, Customers see own)
const getOrders = asyncHandler(async (req, res) => {
    const { customerId } = req.query;

    // Staff see all orders, optionally filtered by customer
    if (req.staff) {
        let query = {};
        if (customerId) {
            query = { customerId };
        }

        const orders = await Order.find(query)
            .sort({ orderTime: -1 })
            .limit(50);
        return res.json(orders);
    }

    // Customers see only their own orders
    if (req.customer) {
        const orders = await Order.find({ customerId: req.customer._id })
            .sort({ orderTime: -1 })
            .limit(20);
        return res.json(orders);
    }

    res.status(401);
    throw new Error('Not authorized to view orders.');
});

// @desc    Update order status (Waiter/Manager only)
// @route   PUT /api/orders/:id/status
// @access  Private (Waiter or higher)
const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;

    // Only Staff (Waiter or higher) can update order status
    if (!req.staff) {
        res.status(403);
        throw new Error('Only staff members can update order status.');
    }

    const order = await Order.findById(orderId);

    if (order) {
        order.status = status;
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(404);
        throw new Error('Order not found');
    }
});

export { createOrder, getOrders, updateOrderStatus };
