// models/Customer.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
    },
    // Email for login - unique and required
    email: {
        type: String,
        required: [true, 'Email is required for customer account'],
        unique: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please provide a valid email'],
        trim: true,
    },
    // Phone for order communication - optional
    phone: {
        type: String,
        trim: true,
    },
    // Password field for customer login
    password: {
        type: String,
        required: [true, 'Password is required for customer account'],
        select: false, // Don't return hash in queries by default
    },
    loyaltyPoints: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
}, {
    timestamps: true,
    collection: 'customers'
});

// --- SCHEMA MIDDLEWARE (SECURITY HOOKS) ---

// Hash password before saving
customerSchema.pre('save', async function () {
    try {
        if (!this.isModified('password')) {
            return;
        }
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});

// Instance method to compare entered password with the hashed password
customerSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
