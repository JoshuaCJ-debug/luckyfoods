// Export current menu products to a JSON file for migration/backup
// Usage: node scripts/export-products.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import { Dish, Drink, Salad } from '../models/Menu.js';

dotenv.config();

async function exportProducts() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected...');

        const dishes = await Dish.find({}).lean();
        const drinks = await Drink.find({}).lean();
        const salads = await Salad.find({}).lean();

        // Remove _id and __v for portable seed data
        const clean = (items) => items.map(({ _id, __v, ...rest }) => rest);

        const output = {
            dishes: clean(dishes),
            drinks: clean(drinks),
            salads: clean(salads),
        };

        const filePath = 'seed-data/products.json';
        fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
        console.log(`✅ Exported ${dishes.length} dishes, ${drinks.length} drinks, ${salads.length} salads → ${filePath}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Export failed:', err);
        process.exit(1);
    }
}

exportProducts();