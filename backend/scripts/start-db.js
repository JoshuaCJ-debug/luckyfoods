// Helper script to start local MongoDB if not already running
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const dbPath = process.env.DB_PATH || 'C:\\data\\db';

// Check if the dbpath exists
if (!fs.existsSync(dbPath)) {
    console.error(`❌ Data directory not found: ${dbPath}`);
    console.error('   Create it with:');
    console.error(`   mkdir -p "${dbPath}"`);
    process.exit(1);
}

// Check if mongod is already running
try {
    execSync('tasklist /fi "imagename eq mongod.exe" /fo csv /nh', {
        encoding: 'utf-8',
        stdio: 'pipe',
    });

    // If we get here without throwing, check the output
    const output = execSync('tasklist /fi "imagename eq mongod.exe" /fo csv /nh', {
        encoding: 'utf-8',
        stdio: 'pipe',
    }).trim();

    if (output && output.includes('mongod.exe')) {
        console.log('✅ MongoDB is already running.');
        process.exit(0);
    }
} catch {
    // tasklist command failed or no output — mongod is not running, proceed to start
}

// Remove stale lock files if any
const lockFiles = ['mongod.lock', 'WiredTiger.lock'];
for (const file of lockFiles) {
    const filePath = path.join(dbPath, file);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`   Removed stale lock file: ${file}`);
        } catch (err) {
            console.error(`   ⚠️  Could not remove ${file}: ${err.message}`);
        }
    }
}

console.log('   Starting MongoDB...');

const mongod = spawn('mongod', ['--dbpath', dbPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    windowsHide: true,
});

let outputData = '';
let errorData = '';

mongod.stdout.on('data', (data) => {
    outputData += data.toString();
});

mongod.stderr.on('data', (data) => {
    errorData += data.toString();
});

// Wait a moment to see if it starts successfully
await new Promise((resolve) => setTimeout(resolve, 3000));

// Check if the process is still running
try {
    process.kill(mongod.pid, 0); // Signal 0 just checks if process exists
    console.log('✅ MongoDB started successfully!');
    console.log(`   Data directory: ${dbPath}`);
    mongod.unref(); // Detach so the parent can exit independently
    process.exit(0);
} catch {
    console.error('❌ MongoDB failed to start. Check the logs:');
    if (errorData) console.error(errorData);
    if (outputData) console.error(outputData);
    process.exit(1);
}