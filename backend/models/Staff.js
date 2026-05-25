// models/Staff.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema({
    // Name is required
    name: {
        type: String,
        required: [true, 'Staff name is required'],
        trim: true,
    },
    // Email for login - unique and required
    email: {
        type: String,
        required: [true, 'Email is required for staff'],
        unique: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please provide a valid email'],
        trim: true,
    },
    // Role must be one of the specified values
    role: {
        type: String,
        enum: ['Admin', 'Manager', 'Waiter'],
        required: [true, 'Staff role is required'],
        default: 'Waiter',
    },
    // Hashed password
    password: {
        type: String,
        required: [true, 'Password is required'],
        select: false, // Important: prevents the password hash from being returned by default queries
    },
    // The contact field (phone number for communication)
    contact: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
    collection: 'staff' // IMPORTANT: Links Mongoose model to your existing 'staff' collection
});

// --- SCHEMA MIDDLEWARE (SECURITY HOOKS) ---

// 1. Hash the password before saving the staff document
staffSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }

    // Hash the password with a cost factor of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// 2. Instance method to compare entered password with the hashed password in the database
staffSchema.methods.matchPassword = async function(enteredPassword) {
    // 'this.password' refers to the HASHED password in the document
    return await bcrypt.compare(enteredPassword, this.password);
};

const Staff = mongoose.models.Staff || mongoose.model('Staff', staffSchema);

export default Staff;