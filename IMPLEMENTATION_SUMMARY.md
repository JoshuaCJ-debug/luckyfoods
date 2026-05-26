# Florence Foods - Auth Refactor & API Unification - Implementation Summary

## Completed Changes

### 1. Backend Models Updated

#### Staff.js
- ✅ Added `email` field (unique, required) - replaces loginContact
- ✅ Updated `role` enum to include 'Admin': ['Admin', 'Manager', 'Waiter']
- ✅ Removed `loginContact` field
- ✅ Kept password hashing middleware (bcryptjs)
- ✅ Schema properly configured for MongoDB

#### Customer.js
- ✅ Added `email` field (unique, required) - new login identifier
- ✅ Changed `contact` field to `phone` for clarity
- ✅ Password hashing middleware configured
- ✅ Email validation included
- ✅ No unique constraint on name (allows duplicates)

#### Order.js
- ✅ Added `customerId` field (ObjectId reference to Customer)
- ✅ Kept `customerName` for historical tracking
- ✅ Added `orderTime` field for better tracking
- ✅ Structure supports new email-based customer lookup

### 2. Authentication & Authorization

#### middleware/auth.js
- ✅ **Unified `protect` middleware**: Handles both staff and customer tokens
- ✅ **RBAC Hierarchy implemented**:
  - Admin (level 4)
  - Manager (level 3)
  - Waiter (level 2)
  - Customer (level 1)
- ✅ **New middleware functions**:
  - `requireRole(role)` - flexible role checking with hierarchy
  - `adminCheck` - admin-only access
  - `managerCheck` - manager or higher access
- ✅ Sets `req.userRole` and `req.user` for all authenticated requests

#### controllers/authController.js
- ✅ **Unified login endpoint**: `/api/auth/login` with email + password only
- ✅ Searches both Staff and Customer by email
- ✅ Returns role in JWT token
- ✅ **Customer registration**: `/api/auth/register` 
  - Public signup for customers only
  - Accepts: name, email, phone (optional), password
  - Validates email uniqueness across staff and customers
- ✅ **Profile endpoint**: `/api/auth/profile` returns user data based on type

#### seed.js
- ✅ Creates initial Admin user (admin@florencefoods.com)
- ✅ Creates Manager user (manager@florencefoods.com)
- ✅ Creates Waiter user (waiter@florencefoods.com)
- ✅ Creates test customers with emails
- ✅ All credentials printed in console on seed execution

### 3. Staff Management (Unified CRUD)

#### controllers/staffController.js
- ✅ **Create Staff** (`POST /api/staff`):
  - Admin only (Manager can only create Waiters)
  - Prevents creating multiple Admins
  - Email uniqueness validation
- ✅ **Get Staff List** (`GET /api/staff`): Manager+ access
- ✅ **Get Single Staff** (`GET /api/staff/:id`): Manager+ access
- ✅ **Update Staff** (`PUT /api/staff/:id`):
  - Admin can change roles
  - Non-admins can only update their own profile
  - Role change prevents removing last Admin
- ✅ **Delete Staff** (`DELETE /api/staff/:id`): Admin only
- ✅ **Change Role** (`POST /api/staff/:id/change-role`): Admin only
  - Promotes/demotes staff to any role (except prevents 2nd Admin)

#### routes/staffRoutes.js
- ✅ Consolidated all staff operations into unified REST endpoints
- ✅ Removed `/api/staff/login` (use `/api/auth/login`)
- ✅ Removed `/api/staff/register` (use POST `/api/staff` with role)
- ✅ All RBAC checks integrated

### 4. Customer Management (Unified CRUD)

#### controllers/customerController.js
- ✅ **Create Customer** (`POST /api/customers`): Manager+ only
  - Can create customers with temp password
- ✅ **Get All Customers** (`GET /api/customers`): Manager+ only
- ✅ **Get Single Customer** (`GET /api/customers/:id`):
  - Customers can view own profile
  - Staff can view any customer
- ✅ **Update Customer** (`PUT /api/customers/:id`):
  - Email uniqueness validation
  - Own profile updates vs staff admin updates
- ✅ **Delete Customer** (`DELETE /api/customers/:id`): Admin only
- ✅ **Update Loyalty Points** (`PUT /api/customers/:id/loyalty-points`): Manager+ only

#### routes/customerRoutes.js
- ✅ RESTful CRUD operations
- ✅ Proper RBAC checks on all routes
- ✅ Removed old naming-based lookups

### 5. Order Management

#### controllers/orderController.js
- ✅ Updated to use `customerId` (ObjectId) instead of customer name
- ✅ Stores both `customerId` and `customerName` for flexibility
- ✅ **Create Order**:
  - Staff: Must provide customerId
  - Customer: Creates own order
- ✅ **Get Orders**:
  - Staff: See all orders (with optional filtering)
  - Customers: See only own orders
- ✅ **Update Order Status**: Staff only

#### routes/orderRoutes.js
- ✅ Simplified with proper RBAC
- ✅ Both staff and customers can create orders
- ✅ Only staff can update order status

### 6. Menu Management

#### routes/menuRoutes.js
- ✅ Updated to use `managerCheck` (works with new RBAC)
- ✅ All menu operations require Manager+ role
- ✅ GET menu accessible to all authenticated users

### 7. Frontend Updates

#### src/App.jsx
- ✅ **Login Screen**:
  - Changed from name/contact to email + password only
  - Proper placeholder text
  - Error handling improved
- ✅ **Registration Screen**:
  - Email field (unique) - required
  - Phone field - optional
  - Name field - required (not unique)
  - All validation included
- ✅ **Auth Context Updated**:
  - Added `userRole` to state
  - Stores role in localStorage
  - Updated login/logout logic
- ✅ **Navigation Component**:
  - **Customer view**: Order Now, My Orders, Loyalty Points
  - **Waiter view**: POS Terminal, Orders Dashboard
  - **Manager view**: Waiter + Menu Editor
  - **Admin view**: Manager + 👑 Admin Panel
- ✅ **New Admin Panel Component**:
  - Staff Management tab:
    - List all staff with roles
    - Promote/demote staff (except Admin)
  - Customers tab:
    - View all customers
    - Display email, phone, loyalty points
  - Menu Management tab: Link to menu editor
  - Orders tab: Link to orders dashboard
  - Statistics tab: Display system stats
- ✅ **Customer Profile Updated**:
  - Shows email instead of contact
  - Shows phone if available
  - Displays loyalty points

## Key Features Implemented

### 1. Role-Based Access Control (RBAC)
- **Hierarchy**: Admin > Manager > Waiter > Customer
- **Backend Enforcement**: All endpoints check role before allowing access
- **Frontend UI**: Dynamic navigation and feature visibility based on role

### 2. Admin Capabilities
- Create staff members (all roles)
- Create additional managers/waiters
- Promote/demote staff to any role
- Cannot create second Admin (only one admin allowed)
- Manage customers, menu, orders from unified admin panel
- View system statistics

### 3. Email-Based Authentication
- **Staff Login**: Email + Password
- **Customer Login**: Email + Password
- **Customer Signup**: Public registration with email, name, phone (optional)
- **Email Uniqueness**: Enforced across entire system (staff + customers)

### 4. Endpoint Unification
- **Old**: `/api/staff/login`, `/api/staff/register`, `/api/staff` 
  - **New**: `/api/auth/login`, `/api/staff` (POST/GET/PUT/DELETE)
- **Old**: `/api/customers` with `GET /api/customers/:name`
  - **New**: `/api/customers` with `GET /api/customers/:id` (standard REST)
- **Old**: Multiple endpoints for different entities
  - **New**: Unified CRUD pattern with consistent RBAC

### 5. Frontend Role-Based Features
- Admins see: Admin panel with staff/customer management
- Managers see: Staff/customer management + menu editor
- Waiters see: POS + orders (read-only)
- Customers see: Order placement + order history + loyalty

## API Endpoints Summary

### Authentication
```
POST   /api/auth/login              - Email + password login
POST   /api/auth/register           - Customer public signup
GET    /api/auth/profile            - Get current user profile
```

### Staff Management (RBAC: Manager+)
```
POST   /api/staff                   - Create staff (Admin only for Managers, Manager only for Waiters)
GET    /api/staff                   - List all staff
GET    /api/staff/:id               - Get single staff
PUT    /api/staff/:id               - Update staff (Admin for role changes)
DELETE /api/staff/:id               - Delete staff (Admin only)
POST   /api/staff/:id/change-role   - Change staff role (Admin only)
```

### Customer Management (RBAC: Manager+)
```
POST   /api/customers                    - Create customer (Admin/Manager only)
GET    /api/customers                    - List all customers
GET    /api/customers/:id                - Get single customer
PUT    /api/customers/:id                - Update customer info
DELETE /api/customers/:id                - Delete customer (Admin only)
PUT    /api/customers/:id/loyalty-points - Update loyalty points (Manager+)
```

### Menu Management (RBAC: Manager+)
```
GET    /api/menu                          - Get all menu items (Authenticated)
POST   /api/menu/:collection              - Create menu item (Manager+)
PUT    /api/menu/:collection/:id          - Update menu item (Manager+)
DELETE /api/menu/:collection/:id          - Delete menu item (Manager+)
```

### Orders (RBAC: All authenticated users)
```
POST   /api/orders                   - Create order (Staff or Customer)
GET    /api/orders                   - Get orders (Staff: all, Customer: own)
PUT    /api/orders/:id/status        - Update order status (Staff only)
```

## Security Measures

✅ JWT tokens include role information
✅ Backend validates role on EVERY protected endpoint
✅ Email uniqueness enforced at database level
✅ Passwords hashed with bcryptjs (salt factor: 10)
✅ Admin role cannot be created by non-admins
✅ Cannot delete last Admin user
✅ Customers can only view/edit their own data (except staff viewing)
✅ Role hierarchy prevents privilege escalation

## Database Schema Changes

### Staff Collection
```javascript
{
  name: String (required),
  email: String (unique, required),
  role: 'Admin' | 'Manager' | 'Waiter' (required),
  password: String (hashed, required),
  contact: String (optional),
  createdAt: Date,
  updatedAt: Date
}
```

### Customer Collection
```javascript
{
  name: String (required),
  email: String (unique, required),
  phone: String (optional),
  password: String (hashed, required),
  loyaltyPoints: Number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```

### Order Collection
```javascript
{
  customerId: ObjectId (ref: Customer),
  customerName: String (required),
  servedBy: String (required),
  items: [{
    name: String,
    quantity: Number,
    price: Number,
    image: String
  }],
  totalAmount: Number,
  status: 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled',
  orderTime: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Testing Seed Data

After running `node seed.js`:

### Staff Accounts
- **Admin**: admin@florencefoods.com / Admin123!
- **Manager**: manager@florencefoods.com / Manager123!
- **Waiter**: waiter@florencefoods.com / Waiter123!

### Customer Accounts
- **Alice**: alice@customer.com / Customer123!
- **Bob**: bob@customer.com / Customer123!

## Migration Notes

### If Migrating From Old System
1. Update existing Staff documents:
   - Add email field (from loginContact or generate)
   - Update role field to new enum values
   - Remove loginContact field

2. Update existing Customer documents:
   - Add email field (generate or use existing data)
   - Rename contact → phone

3. Update existing Order documents:
   - Add customerId field (lookup customer by name)
   - Keep customerName for historical data

4. Re-seed database with new structure

## Files Modified

### Backend
- ✅ `/models/Staff.js` - Updated schema
- ✅ `/models/Customer.js` - Updated schema
- ✅ `/models/Order.js` - Added customerId
- ✅ `/middleware/auth.js` - Complete RBAC rewrite
- ✅ `/controllers/authController.js` - Email-based login
- ✅ `/controllers/staffController.js` - Unified CRUD
- ✅ `/controllers/customerController.js` - Unified CRUD + admin ops
- ✅ `/controllers/orderController.js` - Updated for customerId
- ✅ `/routes/staffRoutes.js` - Consolidated routes
- ✅ `/routes/customerRoutes.js` - Consolidated routes
- ✅ `/routes/orderRoutes.js` - Simplified routes
- ✅ `/routes/menuRoutes.js` - RBAC updated
- ✅ `/seed.js` - New admin + updated data

### Frontend
- ✅ `/src/App.jsx` - Complete refactor:
  - Email-based login/registration
  - Role-based navigation
  - Admin panel component
  - Updated auth context
  - Dynamic feature visibility

## Next Steps (Optional)

1. **Database Migration**: Update existing data to match new schema
2. **Testing**: Run comprehensive tests with new RBAC system
3. **Monitoring**: Add logging for admin actions
4. **Enhancement**: Add audit trail for admin changes
5. **Documentation**: Create API documentation with Swagger/OpenAPI

## Verification Checklist

- ✅ Backend syntax validated
- ✅ All models updated
- ✅ RBAC middleware implemented
- ✅ All endpoints updated with RBAC
- ✅ Frontend login uses email
- ✅ Frontend shows role-based navigation
- ✅ Admin panel created
- ✅ Customer registration with email + phone
- ✅ Email uniqueness enforced
- ✅ Admin role limitations enforced
- ✅ Endpoint consolidation complete
