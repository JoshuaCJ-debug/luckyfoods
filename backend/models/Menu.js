// models/Menu.js
import mongoose from 'mongoose';

// Define a flexible schema for menu items
const menuItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true,
        unique: true,
    },
    // Using mongoose.Schema.Types.Mixed to handle both Number and Embedded Object prices
    price: { 
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Item price is required'],
    },
    image: { // <-- ADDED
        type: String,
        default: null, // Image is optional
    },
    description: { // <-- ADDED
        type: String,
        default: null, // Description is optional
    },
    // You can add fields like category, description, etc., here later if needed
}, {
    timestamps: true,
    // Note: No collection name is specified here; it will be specified on creation.
});

// --- Create Models for Each Collection ---

// 1. Dishes Model (for the 'dishes' collection)
const Dish = mongoose.model('Dish', menuItemSchema, 'dishes');

// 2. Drinks Model (for the 'drinks' collection)
const Drink = mongoose.model('Drink', menuItemSchema, 'drinks');

// 3. Salads Model (for the 'salads' collection)
const Salad = mongoose.model('Salad', menuItemSchema, 'salads');

// Export all models
export { Dish, Drink, Salad };
