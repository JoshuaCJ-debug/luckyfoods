// Script to list all existing users
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Staff from './models/Staff.js';
import Customer from './models/Customer.js';

dotenv.config();

const listUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected...\n');

        // List all staff
        console.log('👨‍💼 STAFF USERS:');
        console.log('================');
        const staff = await Staff.find({}).select('-password');
        if (staff.length === 0) {
            console.log('No staff users found.');
        } else {
            staff.forEach(s => {
                console.log(`  Name: ${s.name}`);
                console.log(`  Role: ${s.role}`);
                console.log(`  Login Contact: ${s.loginContact || s.name}`);
                console.log(`  Contact: ${s.contact}`);
                console.log('');
            });
        }

        // List all customers
        console.log('\n👤 CUSTOMER USERS:');
        console.log('=================');
        const customers = await Customer.find({}).select('-password');
        if (customers.length === 0) {
            console.log('No customer users found.');
        } else {
            customers.forEach(c => {
                console.log(`  Name: ${c.name}`);
                console.log(`  Contact: ${c.contact || 'N/A'}`);
                console.log(`  Loyalty Points: ${c.loyaltyPoints || 0}`);
                console.log('');
            });
        }

        console.log('\n📋 Passwords are configured via env (SEED_STAFF_PASSWORD / SEED_CUSTOMER_PASSWORD)');
        console.log('   Defaults: Staff=Staff123!, Customer=Customer123!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

listUsers();