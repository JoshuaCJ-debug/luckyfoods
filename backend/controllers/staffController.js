// controllers/staffController.js - Unified staff management with RBAC
import asyncHandler from 'express-async-handler';
import Staff from '../models/Staff.js';
import jwt from 'jsonwebtoken';

// Utility to generate JWT
const generateToken = (id, email, role) => {
    return jwt.sign({ id, email, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Create a new staff member (Admin/Manager only)
// @route   POST /api/staff
// @access  Private/Admin or Manager (Manager can only create Waiters)
const createStaff = asyncHandler(async (req, res) => {
    const { name, email, role, contact, password } = req.body;

    if (!name || !email || !role || !password) {
        res.status(400);
        throw new Error('Name, email, role, and password are required');
    }

    // Check if Admin is trying to create another Admin (only one admin allowed)
    if (role === 'Admin') {
        const adminExists = await Staff.findOne({ role: 'Admin' });
        if (adminExists && adminExists._id.toString() !== req.staff._id.toString()) {
            res.status(400);
            throw new Error('An Admin already exists. Only one Admin is allowed.');
        }
    }

    // Check if staff already exists by email
    const staffExists = await Staff.findOne({ email });
    if (staffExists) {
        res.status(400);
        throw new Error('Staff member with this email already exists');
    }

    // Manager can only create Waiters
    if (req.staff.role === 'Manager' && role !== 'Waiter') {
        res.status(403);
        throw new Error('Managers can only create Waiter accounts');
    }

    // Create the new staff member
    const staff = await Staff.create({
        name,
        email,
        role,
        contact,
        password,
    });

    res.status(201).json({
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        contact: staff.contact,
        token: generateToken(staff._id, staff.email, staff.role),
    });
});

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private/Manager or higher
const getStaffMembers = asyncHandler(async (req, res) => {
    const staff = await Staff.find({}).select('-password');
    res.json(staff);
});

// @desc    Get single staff member by ID
// @route   GET /api/staff/:id
// @access  Private/Manager or higher
const getStaffById = asyncHandler(async (req, res) => {
    const staff = await Staff.findById(req.params.id).select('-password');
    
    if (!staff) {
        res.status(404);
        throw new Error('Staff member not found');
    }

    res.json(staff);
});

// @desc    Update staff member details (Admin only for role changes)
// @route   PUT /api/staff/:id
// @access  Private/Admin (or staff can update own profile except role)
const updateStaff = asyncHandler(async (req, res) => {
    const { name, contact, role } = req.body;
    const staffId = req.params.id;

    const staff = await Staff.findById(staffId);
    if (!staff) {
        res.status(404);
        throw new Error('Staff member not found');
    }

    // Non-admin staff can only update their own profile and not the role
    if (req.staff.role !== 'Admin' && req.staff._id.toString() !== staffId) {
        res.status(403);
        throw new Error('You can only update your own profile');
    }

    // Only Admin can change roles
    if (role && req.staff.role !== 'Admin') {
        res.status(403);
        throw new Error('Only Admin can change staff roles');
    }

    // If trying to set Admin role, check only one exists
    if (role === 'Admin') {
        const adminExists = await Staff.findOne({ role: 'Admin', _id: { $ne: staffId } });
        if (adminExists) {
            res.status(400);
            throw new Error('An Admin already exists. Only one Admin is allowed.');
        }
    }

    const updatedStaff = await Staff.findByIdAndUpdate(
        staffId,
        {
            ...(name && { name }),
            ...(contact && { contact }),
            ...(role && { role }),
        },
        { new: true, runValidators: true }
    ).select('-password');

    res.json(updatedStaff);
});

// @desc    Delete a staff member (Admin only)
// @route   DELETE /api/staff/:id
// @access  Private/Admin
const deleteStaff = asyncHandler(async (req, res) => {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
        res.status(404);
        throw new Error('Staff member not found');
    }

    // Prevent deleting the last Admin
    if (staff.role === 'Admin') {
        const otherAdmins = await Staff.countDocuments({ role: 'Admin', _id: { $ne: req.params.id } });
        if (otherAdmins === 0) {
            res.status(400);
            throw new Error('Cannot delete the last Admin user');
        }
    }

    await Staff.findByIdAndDelete(req.params.id);

    res.json({ message: 'Staff member deleted successfully' });
});

// @desc    Promote/Demote staff to a specific role (Admin only)
// @route   POST /api/staff/:id/change-role
// @access  Private/Admin
const changeStaffRole = asyncHandler(async (req, res) => {
    const { newRole } = req.body;

    if (!newRole) {
        res.status(400);
        throw new Error('New role is required');
    }

    const validRoles = ['Admin', 'Manager', 'Waiter'];
    if (!validRoles.includes(newRole)) {
        res.status(400);
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const staff = await Staff.findById(req.params.id);
    if (!staff) {
        res.status(404);
        throw new Error('Staff member not found');
    }

    // Check if trying to create a second Admin
    if (newRole === 'Admin') {
        const adminExists = await Staff.findOne({ role: 'Admin', _id: { $ne: req.params.id } });
        if (adminExists) {
            res.status(400);
            throw new Error('An Admin already exists. Only one Admin is allowed.');
        }
    }

    staff.role = newRole;
    await staff.save();

    res.json({
        message: `Staff member promoted/demoted to ${newRole}`,
        staff: staff,
    });
});

export { createStaff, getStaffMembers, getStaffById, updateStaff, deleteStaff, changeStaffRole };
