import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsFile = path.resolve(__dirname, '../seed-data/products.json');

async function update() {
    if (!fs.existsSync(productsFile)) {
        console.error('products.json not found');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const data = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
    const db = mongoose.connection.db;
    const collections = ['dishes', 'drinks', 'salads'];
    let updated = 0;

    for (const collName of collections) {
        const seedItems = data[collName];
        if (!seedItems) continue;

        const coll = db.collection(collName);
        const cloudUrls = Object.fromEntries(
            seedItems.map(item => [item.name, item.image])
        );

        const items = await coll.find({ name: { $in: Object.keys(cloudUrls) } }).toArray();

        for (const item of items) {
            const targetUrl = cloudUrls[item.name];
            if (!targetUrl) continue;
            if (item.image && (item.image.startsWith('http') || item.image.startsWith(targetUrl))) continue;

            await coll.updateOne(
                { _id: item._id },
                { $set: { image: targetUrl } }
            );
            console.log(`  ${collName.slice(0, -1)} "${item.name}": ${item.image || '(none)'} -> ${targetUrl}`);
            updated++;
        }
    }

    console.log(`\nDone. ${updated} items updated.`);
    await mongoose.disconnect();
    process.exit(0);
}

update().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
