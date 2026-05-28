// Seed script - Creates test users (ADDITIVE ONLY - does NOT delete existing data)
// Usage:
//   npm run seed              - Add test users (safe, won't delete anything)
//   npm run seed -- --reset   - WIPE ALL COLLECTIONS then add test users (destructive!)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import Staff from './models/Staff.js';
import Customer from './models/Customer.js';
import { Dish, Drink, Salad } from './models/Menu.js';
import Order from './models/Order.js';

dotenv.config();

const shouldReset = process.argv.includes('--reset');

const seedProducts = async () => {
    const productsFile = 'seed-data/products.json';
    if (!fs.existsSync(productsFile)) {
        console.log('   ⚠️  Product data file not found. Run `npm run export` first.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));

    // Seed dishes
    for (const item of data.dishes) {
        try {
            await Dish.create(item);
            console.log(`   ✅ Dish added: ${item.name}`);
        } catch (err) {
            console.log(`   ⚠️  Dish "${item.name}" already exists: ${err.message}`);
        }
    }

    // Seed drinks
    for (const item of data.drinks) {
        try {
            await Drink.create(item);
            console.log(`   ✅ Drink added: ${item.name}`);
        } catch (err) {
            console.log(`   ⚠️  Drink "${item.name}" already exists: ${err.message}`);
        }
    }

    // Seed salads
    for (const item of data.salads) {
        try {
            await Salad.create(item);
            console.log(`   ✅ Salad added: ${item.name}`);
        } catch (err) {
            console.log(`   ⚠️  Salad "${item.name}" already exists: ${err.message}`);
        }
    }
};

const seedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected for seeding...');

        // Drop stale indexes that would block seeding
        const staffCol = mongoose.connection.db.collection('staff');
        const indexes = await staffCol.indexes();
        const staleIndex = indexes.find(i => i.name === 'loginContact_1');
        if (staleIndex) {
            await staffCol.dropIndex('loginContact_1');
            console.log('   🧹 Dropped stale loginContact_1 index from staff collection');
        }

        // RESET MODE: Only if explicitly requested with --reset flag
        if (shouldReset) {
            console.log('\n⚠️  ⚠️  ⚠️  WARNING: RESET MODE ⚠️  ⚠️  ⚠️');
            console.log('   All collections will be DELETED: Staff, Customer, Menu, Order');
            console.log('   • Products added through the app interface will be LOST');
            console.log('   • Only products in seed-data/products.json will be restored');
            console.log('   • Run `npm run export` FIRST to backup any new products\n');
            console.log('   Press Ctrl+C within 5 seconds to cancel...');
            await new Promise(r => setTimeout(r, 5000));
            console.log('   Proceeding with reset...\n');
            
            await Staff.deleteMany({});
            await Customer.deleteMany({});
            await Dish.deleteMany({});
            await Drink.deleteMany({});
            await Salad.deleteMany({});
            await Order.deleteMany({});
            
            console.log('✅ All collections cleared');
            
            // Re-seed products from backup file
            console.log('\n📦 Re-seeding products from backup file...');
            console.log('   ⚠️ Any products added via the interface are now LOST.');
            await seedProducts();
        } else {
            console.log('\n📝 SAFE MODE: Only creating/updating test users');
            console.log('   Existing products, orders, and other data will NOT be deleted\n');
        }

        // Password configuration — read from env (no fallbacks; must be set in .env)
        const STAFF_PASSWORD = process.env.SEED_STAFF_PASSWORD;
        const CUSTOMER_PASSWORD = process.env.SEED_CUSTOMER_PASSWORD;
        if (!STAFF_PASSWORD) throw new Error('SEED_STAFF_PASSWORD not set in .env');
        if (!CUSTOMER_PASSWORD) throw new Error('SEED_CUSTOMER_PASSWORD not set in .env');

        // Create Staff Users (including Admin)
        const staffUsers = [
            {
                name: 'Admin User',
                email: 'admin@florencefoods.com',
                role: 'Admin',
                contact: '256700000000',
                password: STAFF_PASSWORD
            },
            {
                name: 'Manager Florence',
                email: 'manager@florencefoods.com',
                role: 'Manager',
                contact: '256700000001',
                password: STAFF_PASSWORD
            },
            {
                name: 'Waiter John',
                email: 'waiter@florencefoods.com',
                role: 'Waiter',
                contact: '256701000001',
                password: STAFF_PASSWORD
            }
        ];

        // Create Customer Users
        const customerUsers = [
            {
                name: 'Customer Alice',
                email: 'alice@customer.com',
                phone: '256702000002',
                password: CUSTOMER_PASSWORD,
                loyaltyPoints: 100
            },
            {
                name: 'Customer Bob',
                email: 'bob@customer.com',
                phone: '256703000003',
                password: CUSTOMER_PASSWORD,
                loyaltyPoints: 50
            }
        ];

        // Insert staff users
        const createdStaff = [];
        for (const staffData of staffUsers) {
            try {
                const staff = await Staff.create(staffData);
                createdStaff.push(staff);
                console.log(`✅ Staff created: ${staff.name} (${staff.role})`);
            } catch (err) {
                console.log(`⚠️  Staff "${staffData.name}" may already exist: ${err.message}`);
            }
        }

        // Insert customer users
        const createdCustomers = [];
        for (const customerData of customerUsers) {
            try {
                const customer = await Customer.create(customerData);
                createdCustomers.push(customer);
                console.log(`✅ Customer created: ${customer.name}`);
            } catch (err) {
                console.log(`⚠️  Customer "${customerData.name}" may already exist: ${err.message}`);
            }
        }

        console.log('\n🎉 Seeding completed!');
        console.log('\n📋 CREDENTIALS SUMMARY:');
        console.log('\n👨‍💼 STAFF LOGIN:');
        createdStaff.forEach((staff, index) => {
            console.log(`  - Name: ${staff.name}`);
            console.log(`    Email: ${staff.email}`);
            console.log(`    Role: ${staff.role}`);
            console.log(`    Password: ${staffUsers[index].password}`);
            console.log('');
        });

        console.log('\n👤 CUSTOMER LOGIN:');
        createdCustomers.forEach((customer, index) => {
            console.log(`  - Name: ${customer.name}`);
            console.log(`    Email: ${customer.email}`);
            console.log(`    Password: ${customerUsers[index].password}`);
            console.log(`    Loyalty Points: ${customer.loyaltyPoints}`);
            console.log('');
        });
        
        if (shouldReset) {
            console.log('\n⚠️  RESET MODE APPLIED:');
            console.log('   ✅ All collections were wiped and recreated');
            console.log('   ✅ Products restored from backup');
        } else {
            console.log('\n✅ SAFE MODE:');
            console.log('   • Existing menu items: PRESERVED');
            console.log('   • Existing orders: PRESERVED');
            console.log('   • Existing customers (non-test): PRESERVED');
            console.log('   • Only test users created/updated');
        }
        
        console.log('\n🔑 Passwords read from environment variables (SEED_STAFF_PASSWORD / SEED_CUSTOMER_PASSWORD)');
        
        console.log('\n💡 USAGE:');
        console.log('   npm run seed              - Safe mode (preserve data)');
        console.log('   npm run seed -- --reset   - Reset mode (wipe all)');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error during seeding:', error);
        process.exit(1);
    }
};

seedUsers();