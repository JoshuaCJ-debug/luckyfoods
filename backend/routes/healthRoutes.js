// Health check route — used by external uptime monitors to keep the server warm
// and prevent Render's free tier from sleeping after 14 minutes of inactivity.

import { Router } from 'express';

const router = Router();

// Simple GET /health — always returns 200 with server status
// This lightweight endpoint is perfect for cron-job.org, UptimeRobot, etc.
router.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

export default router;