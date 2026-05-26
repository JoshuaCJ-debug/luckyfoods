# Florence Foods - Quick Start Guide

## What Changed?

### Login
- **Before**: Name/Contact + Password
- **After**: Email + Password (for everyone)

### User Creation
- **Customers**: Self-signup with email, name, phone (optional)
- **Staff**: Admin creates only (not self-signup)

### Roles
- **Admin**: 👑 Can do EVERYTHING (manage staff, customers, menu, orders)
- **Manager**: 🔵 Can manage staff, customers, menu, orders
- **Waiter**: 🟢 Can view/update orders and customers
- **Customer**: Can order, view history, earn loyalty points

### Key Features
1. Email is now the unique identifier (not name)
2. Admin can promote/demote any staff member
3. Admin panel for system management
4. Role-based navigation (different menus for different roles)

---

## Setup Steps

### 1. Start MongoDB
```bash
# Make sure MongoDB is running on localhost:27017
# Or update .env with your MongoDB URI
```

### 2. Seed Database
```bash
cd backend
node seed.js
```

**Credentials created:**
```
ADMIN:
  Email: admin@florencefoods.com
  Pass:  Admin123!

MANAGER:
  Email: manager@florencefoods.com
  Pass:  Manager123!

WAITER:
  Email: waiter@florencefoods.com
  Pass:  Waiter123!

CUSTOMERS:
  Email: alice@customer.com
  Pass:  Customer123!
  
  Email: bob@customer.com
  Pass:  Customer123!
```

### 3. Start Backend
```bash
cd backend
npm start
# Server runs on http://localhost:5000
```

### 4. Start Frontend
```bash
cd frontend/florence_foods
npm run dev
# Frontend runs on http://localhost:5173 (or displayed URL)
```

---

## Login Flow

### Step 1: Go to App
```
http://localhost:5173
```

### Step 2: Choose Action

**Existing User (Staff):**
- Click "Sign In"
- Enter email (e.g., admin@florencefoods.com)
- Enter password
- Click "Sign In"

**New Customer:**
- Click "Register as Customer"
- Enter Name
- Enter Email
- Enter Phone (optional)
- Enter Password
- Click "Register & Log In"

---

## Admin Panel

### Access
1. Login as Admin (admin@florencefoods.com)
2. Look for "👑 Admin Panel" in navigation
3. Click to access admin panel

### Tabs Available
1. **Staff Management**
   - View all staff
   - Promote Waiters to Managers
   - Demote Managers to Waiters
   
2. **Customers**
   - View all registered customers
   - See email, phone, loyalty points
   
3. **Menu Management**
   - Link to menu editor
   
4. **Orders Dashboard**
   - View all system orders
   
5. **Statistics**
   - Total staff count
   - Total customers
   - System info

---

## Role Capabilities

### Admin (👑)
✅ Create any staff (Manager/Waiter/other Admin prohibited)  
✅ Promote/Demote staff to any role  
✅ Delete staff members  
✅ Create customers  
✅ Delete customers  
✅ Manage menu (create/edit/delete items)  
✅ View all orders  
✅ Access admin panel  
✅ View system statistics  
❌ Cannot create a second Admin  

### Manager (🔵)
✅ Create Waiters  
✅ View all staff  
✅ Create customers  
✅ View/update customers  
✅ Manage menu (create/edit/delete items)  
✅ View all orders  
✅ Update order status  
✅ Add loyalty points to customers  
❌ Cannot promote/demote staff  
❌ Cannot create Managers  

### Waiter (🟢)
✅ View customer list  
✅ Create orders on behalf of customers  
✅ View all orders  
✅ Update order status (Pending → Preparing → Ready → Completed)  
❌ Cannot manage staff  
❌ Cannot manage menu  
❌ Cannot manage customers  

### Customer
✅ Register (public)  
✅ Login  
✅ View menu  
✅ Create orders  
✅ View own orders  
✅ View loyalty points  
❌ Cannot view other customer data  
❌ Cannot manage staff  

---

## Common Tasks

### Admin: Create a New Manager
1. Login as Admin
2. Click "👑 Admin Panel"
3. Go to "Staff Management" tab
4. Staff list appears
5. (Note: UI doesn't show create yet, use API: POST /api/staff with role: 'Manager')

### Admin: Promote Waiter to Manager
1. Login as Admin
2. Click "👑 Admin Panel"
3. Go to "Staff Management" tab
4. Find Waiter in list
5. Click "Promote to Manager"
6. Role updated!

### Manager: Add Menu Item
1. Login as Manager
2. Click "Menu Editor"
3. Add new dish, drink, or salad
4. Set price, name, image
5. Click "Create"

### Waiter: Process Order
1. Login as Waiter
2. Click "POS Terminal" (for staff) or "Order Now" (self-service)
3. Select customer
4. Select items from menu
5. Click "Place Order"
6. Customer receives loyalty points

### Customer: Register & Order
1. Go to app
2. Click "Register as Customer"
3. Fill in email (unique), name, phone (optional), password
4. Click "Register & Log In"
5. Click "Order Now"
6. Select items
7. Click "Place Order"
8. Check "My Orders" to see order status

---

## API Examples

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@florencefoods.com",
    "password": "Admin123!"
  }'

# Response:
{
  "_id": "...",
  "name": "Admin User",
  "email": "admin@florencefoods.com",
  "role": "Admin",
  "userType": "staff",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Register Customer
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "256712345678",
    "password": "Secure123!"
  }'
```

### Create Staff (Admin Only)
```bash
curl -X POST http://localhost:5000/api/staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "New Manager",
    "email": "manager2@florencefoods.com",
    "role": "Manager",
    "contact": "256700000001",
    "password": "Manager123!"
  }'
```

### Promote Staff (Admin Only)
```bash
curl -X POST http://localhost:5000/api/staff/STAFF_ID/change-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "newRole": "Manager"
  }'
```

---

## Troubleshooting

### "Invalid email or password"
- Check email is correct (not name!)
- Verify password is correct
- Make sure user exists in database

### "Not authorized. Required role: Manager or higher"
- Your account doesn't have permission
- Login as Admin or Manager instead
- Ask Admin to promote your account

### "An Admin already exists"
- Only one Admin allowed in system
- Contact Admin if you need admin access

### "Email already in use"
- Email must be unique
- Use different email for new account

### Frontend shows "Can't reach server"
- Make sure backend is running: `npm start` in backend folder
- Check backend is on port 5000
- Check MongoDB is connected

---

## Database Reset

If you need to start fresh:

### Reset Everything
```bash
cd backend

# Delete database
# (depends on your MongoDB setup)

# Re-seed
node seed.js

# Restart backend
npm start
```

---

## API Endpoint Reference

All endpoints require `Authorization: Bearer TOKEN` except login/register.

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | /api/auth/login | Public | Login |
| POST | /api/auth/register | Public | Customer signup |
| GET | /api/auth/profile | Auth | Get user profile |
| POST | /api/staff | Admin | Create staff |
| GET | /api/staff | Manager+ | List staff |
| GET | /api/staff/:id | Manager+ | Get staff details |
| PUT | /api/staff/:id | Admin* | Update staff |
| DELETE | /api/staff/:id | Admin | Delete staff |
| POST | /api/staff/:id/change-role | Admin | Change staff role |
| POST | /api/customers | Manager+ | Create customer |
| GET | /api/customers | Manager+ | List customers |
| GET | /api/customers/:id | Auth | Get customer details |
| PUT | /api/customers/:id | Auth* | Update customer |
| DELETE | /api/customers/:id | Admin | Delete customer |
| PUT | /api/customers/:id/loyalty-points | Manager+ | Update loyalty |
| GET | /api/menu | Auth | View menu |
| POST | /api/menu/:collection | Manager+ | Create menu item |
| PUT | /api/menu/:collection/:id | Manager+ | Update menu item |
| DELETE | /api/menu/:collection/:id | Manager+ | Delete menu item |
| POST | /api/orders | Auth | Create order |
| GET | /api/orders | Auth* | Get orders |
| PUT | /api/orders/:id/status | Staff | Update order status |

\* = Additional restrictions apply (own data or all data based on role)

---

## Questions?

Refer to IMPLEMENTATION_SUMMARY.md for detailed technical info.
