// controllers/menuController.js
import asyncHandler from 'express-async-handler';
import { Dish, Drink, Salad } from '../models/Menu.js';
import mongoose from 'mongoose';

// @desc    Get all menu items (all three collections)
// @route   GET /api/menu
// @access  Public (no authentication required — guests can browse the menu)
const getMenu = asyncHandler(async (req, res) => {
    const [dishes, drinks, salads] = await Promise.all([
        Dish.find({}),
        Drink.find({}),
        Salad.find({})
    ]);

    // Return the combined menu as a structured object
    res.json({
        dishes,
        drinks,
        salads,
        lastFetched: new Date(),
    });
});

// @desc    Update the price of a specific menu item
// @route   PUT /api/menu/:collection/:id
// @access  Private/Manager Only
const updateMenuItem = asyncHandler(async (req, res) => {
    const { collection, id } = req.params;
    const { price, nestedKey } = req.body; 

    if (!price) {
        res.status(400);
        throw new Error('Price field is required for update.');
    }

    // 1. Determine Mongoose Model
    let Model;
    switch (collection.toLowerCase()) {
        case 'dishes': Model = Dish; break;
        case 'drinks': Model = Drink; break;
        case 'salads': Model = Salad; break;
        default:
            res.status(400);
            throw new Error(`Invalid collection name: ${collection}`);
    }

    // 2. Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error('Invalid item ID format');
    }
    
    // 3. Prepare the Update Object (Handles nested updates)
    let updateOperation = {};

    if (nestedKey) {
        // Use dot notation to update only that sub-field (e.g., price.beef_katogo)
        updateOperation = { $set: { [`price.${nestedKey}`]: price } };
    } else {
        // Replace the entire 'price' field (simple update)
        updateOperation = { $set: { price: price } };
    }

    // 4. Find and Update the item
    const updatedItem = await Model.findByIdAndUpdate(
        id, 
        updateOperation, 
        { new: true, runValidators: true } 
    );

    if (!updatedItem) {
        res.status(404);
        throw new Error(`Item with ID ${id} not found in ${collection}`);
    }

    res.json(updatedItem);
});

// @desc    Create a new menu item
// @route   POST /api/menu/:collection
// @access  Private/Manager Only
const createMenuItem = asyncHandler(async (req, res) => {
    const { collection } = req.params;
    const itemData = req.body;

    let Model;
    switch (collection.toLowerCase()) {
        case 'dishes': Model = Dish; break;
        case 'drinks': Model = Drink; break;
        case 'salads': Model = Salad; break;
        default:
            res.status(400);
            throw new Error(`Invalid collection name: ${collection}`);
    }

    try {
        const newItem = await Model.create(itemData);
        res.status(201).json(newItem); // 201 Created
    } catch (error) {
        res.status(400);
        throw new Error(`Failed to create item in ${collection}: ${error.message}`);
    }
});

// @desc    Delete a menu item
// @route   DELETE /api/menu/:collection/:id
// @access  Private/Manager Only
const deleteMenuItem = asyncHandler(async (req, res) => {
    const { collection, id } = req.params;

    let Model;
    switch (collection.toLowerCase()) {
        case 'dishes': Model = Dish; break;
        case 'drinks': Model = Drink; break;
        case 'salads': Model = Salad; break;
        default:
            res.status(400);
            throw new Error(`Invalid collection name: ${collection}`);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error('Invalid item ID format');
    }

    const deletedItem = await Model.findByIdAndDelete(id);

    if (!deletedItem) {
        res.status(404);
        throw new Error(`Item with ID ${id} not found in ${collection}`);
    }

    res.json({ message: `Item with ID ${id} removed from ${collection}` });
});

export { getMenu, updateMenuItem, createMenuItem, deleteMenuItem };
