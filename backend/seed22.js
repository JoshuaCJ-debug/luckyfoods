// Seed script - Creates test users (ADDITIVE ONLY - does NOT delete existing data)
// Usage:
//   npm run seed              - Add test users (safe, won't delete anything)
//   npm run seed -- --reset   - WIPE ALL COLLECTIONS then add test users (destructive!)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import Staff from './models/Staff.js';


dotenv.config();


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
            }
        ];

       

function insertstuff(){
        // Insert staff users
        const createdStaff = [];
        for (const staffData of staffUsers) {
                const staff = Staff.create(staffData);
                createdStaff.push(staff);}}
              


insertstuff();