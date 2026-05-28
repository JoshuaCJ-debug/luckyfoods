import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.resolve(__dirname, '../../frontend/public/images/menu');

const MONGO_URI = process.env.MONGO_URI;

async function migrate() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = ['dishes', 'drinks', 'salads'];
    let total = 0;

    for (const collName of collections) {
        const coll = db.collection(collName);
        const items = await coll.find({ image: { $ne: null, $not: /^http/ } }).toArray();

        for (const item of items) {
            const filePath = path.join(IMAGES_DIR, item.image);
            if (!fs.existsSync(filePath)) {
                console.log(`  SKIP ${item.image} — not found on disk`);
                continue;
            }

            try {
                const result = await cloudinary.uploader.upload(filePath, {
                    folder: 'luckyfoods/menu',
                    public_id: path.parse(item.image).name,
                    transformation: [
                        { width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
                    ],
                });

                await coll.updateOne(
                    { _id: item._id },
                    { $set: { image: result.secure_url } }
                );

                console.log(`  OK   ${item.image} → ${result.secure_url}`);
                total++;
            } catch (err) {
                console.error(`  FAIL ${item.image}:`, err.message || err, err.http_code ? `(HTTP ${err.http_code})` : '');
            }
        }
    }

    console.log(`\nDone. ${total} images migrated.`);
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
