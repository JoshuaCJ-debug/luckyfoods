// controllers/paymentController.js - Simulated payment processing
import asyncHandler from 'express-async-handler';

// @desc    Process a simulated payment
// @route   POST /api/payments/process
// @access  Private (authenticated users)
const processPayment = asyncHandler(async (req, res) => {
    const { amount, currency = 'UGX' } = req.body;

    if (!amount || amount <= 0) {
        res.status(400);
        throw new Error('Invalid payment amount.');
    }

    // Simulate 3-second payment processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Always succeed for demo purposes
    const paymentResult = {
        success: true,
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        amount,
        currency,
        message: 'Payment processed successfully.',
        timestamp: new Date().toISOString(),
    };

    res.status(200).json(paymentResult);
});

export { processPayment };