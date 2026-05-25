// models/Order.js
import mongoose from 'mongoose';

// 1. Schema for individual items within the order (Embedded Document)
const orderItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number, // Price *at the time of the order* (important for historical accuracy)
        required: true,
    },
    image: {
        type: String,
        default: null, // Image is optional
    },
}, { _id: false }); // We don't need unique IDs for every embedded item

// 2. Main Order Schema
const orderSchema = new mongoose.Schema({
    // --- Customer Reference ---
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer ID is required'],
    },
    customerName: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
    },
    
    // --- Staff Reference ---
    servedBy: {
        type: String,
        required: [true, 'Server name is required'],
        trim: true,
    },

    // --- Order Details ---
    items: [orderItemSchema], // Array of the embedded items

    totalAmount: {
        type: Number,
        required: true,
        default: 0.00,
    },

    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'],
        default: 'Pending',
    },

    orderTime: {
        type: Date,
        default: Date.now,
    }
}, {
    timestamps: true,
    collection: 'orders' // IMPORTANT: Links Mongoose model to my existing 'orders' collection
});

const Order = mongoose.model('Order', orderSchema);

export default Order;
