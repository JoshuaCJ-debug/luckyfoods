import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import authRoutes from './routes/authRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';
import menuRoutes from './routes/menuRoutes.js';
import { getMenu } from './controllers/menuController.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import { isProduction, isLocalDev, getEnvironmentLabel } from './config/env.js';

//load the environment varriable from .env file
dotenv.config();

//initialize the express object using the app varriable constant 
const app = express();

// ─── CORS Configuration ─────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
            return callback(null, true);
        }
        console.warn(`⚠️  Blocked CORS request from: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

//middleware
app.use(express.json());
app.use(cors(corsOptions));

// Apply rate limiting to all /api routes
app.use('/api', apiLimiter);

// ─── Auto-start MongoDB (LOCAL DEV ONLY) ─────────────────────────────────
const DB_PATH = process.env.DB_PATH || 'C:\\data\\db';

function ensureMongoDBRunning() {
    // In production (Atlas), do NOT try to start mongod
    if (isProduction()) {
        console.log(`   ${getEnvironmentLabel()} — skipping local MongoDB startup.`);
        process.env.MONGO_MANAGED_EXTERNALLY = 'true';
        return;
    }

    // Check if mongod is already running
    let alreadyRunning = false;
    try {
        const output = execSync(
            'tasklist /fi "imagename eq mongod.exe" /fo csv /nh',
            { encoding: 'utf-8', stdio: 'pipe' }
        ).trim();
        if (output && output.includes('mongod.exe')) {
            alreadyRunning = true;
        }
    } catch {
        // Not running — will start it below
    }

    if (alreadyRunning) {
        console.log('⚠️  MongoDB is externally managed — will not auto-stop on shutdown.');
        process.env.MONGO_MANAGED_EXTERNALLY = 'true';
        return;
    }

    // Remove stale lock files
    for (const file of ['mongod.lock', 'WiredTiger.lock']) {
        const filePath = `${DB_PATH}\\${file}`;
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch { /* ignore */ }
    }

    console.log('   Starting MongoDB...');

    const mongod = spawn('mongod', ['--dbpath', DB_PATH], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,   // Keep attached so we can stop it on shutdown
        windowsHide: true,
    });

    mongod.stderr.on('data', (data) => {
        const msg = data.toString();
        // Only print important messages, not all the startup noise
        if (msg.includes('waiting for connections') || msg.includes('shutdown complete')) {
            process.stdout.write(`   mongod: ${msg}`);
        }
    });

    // Store reference for graceful shutdown
    process.__mongod = mongod;
}

function stopMongoDB() {
    if (process.env.MONGO_MANAGED_EXTERNALLY === 'true' || isProduction()) {
        console.log('   (skipping mongod stop — externally managed or production)');
        return;
    }
    if (process.__mongod) {
        try {
            process.kill(process.__mongod.pid, 'SIGTERM');
            console.log('   MongoDB stopped gracefully.');
        } catch {
            // Already dead
        }
    }
}

// ─── Test credentials display ────────────────────────────────────────────
async function printTestCredentials() {
    try {
        const db = mongoose.connection.db;
        const staffCollection = db.collection('staff');
        const customersCollection = db.collection('customers');

        const staff = await staffCollection.find({}).toArray();
        const customers = await customersCollection.find({}).toArray();

        if (staff.length === 0 && customers.length === 0) return;

        console.log('\n═══════════════════════════════════════');
        console.log('      🧪 TEST CREDENTIALS');
        console.log('═══════════════════════════════════════');

        if (staff.length > 0) {
            console.log('\n  👨‍💼 STAFF LOGIN:');
            console.log('  ───────────────────────────────');
            for (const s of staff) {
                console.log(`    Name:     ${s.name}`);
                console.log(`    Email:    ${s.email}`);
                console.log(`    Role:     ${s.role}`);
                console.log('');
            }
        }

        if (customers.length > 0) {
            console.log('  👤 CUSTOMER LOGIN:');
            console.log('  ───────────────────────────────');
            for (const c of customers) {
                console.log(`    Name:     ${c.name}`);
                console.log(`    Email:    ${c.email}`);
                console.log(`    Phone:    ${c.phone || 'N/A'}`);
                console.log(`    Points:   ${c.loyaltyPoints || 0}`);
                console.log('');
            }
        }

        console.log('  💡 Passwords are set during seed (check seed.js or .env)');
        console.log('═══════════════════════════════════════\n');
    } catch {
        // Silently ignore — credentials display is just a convenience
    }
}

// ─── Database connection ──────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
    ensureMongoDBRunning();

    // Wait a moment for mongod to be ready
    for (let attempt = 0; attempt < 30; attempt++) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log(`MongoDB connected successfully! 🟢  [${getEnvironmentLabel()}]`);
            await printTestCredentials();
            return;
        } catch (err) {
            if (attempt === 0) console.log('   Waiting for MongoDB to accept connections...');
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.error('❌ Could not connect to MongoDB after 30 seconds.');
    process.exit(1);
}

// ─── Shutdown handler ─────────────────────────────────────────────────────
process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('   MongoDB connection closed.');
    } catch { /* ignore */ }
    stopMongoDB();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    try {
        await mongoose.connection.close();
    } catch { /* ignore */ }
    stopMongoDB();
    process.exit(0);
});

//sample test route
app.get('/', (req, res) => {
  res.send('Florence Foods API is running securely! 🛡️');
});

// API Routes
app.use('/api/auth', authRoutes); // Unified authentication
app.use('/api/staff', staffRoutes);
// Explicit public GET for menu to ensure public access (bypass any accidental middleware)
app.get('/api/menu', getMenu);
app.use('/api/menu', menuRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);

//errro handler midlewares
app.use(notFound);
app.use(errorHandler);

//start the server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} 🌐`);
      console.log(`Environment: ${getEnvironmentLabel()}`);
      console.log('───────────────────────────────────────');
      if (isLocalDev()) console.log('Press Ctrl+C to stop server and MongoDB');
    });
});