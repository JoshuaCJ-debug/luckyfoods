# Florence Foods - Seeding Strategy Guide

## Overview

The Florence Foods seed script is designed with **data safety as the priority**. By default, it operates in **SAFE MODE** and never deletes existing data.

---

## 🛡️ Safe Mode (Default)

**Command**: `npm run seed`

### Behavior

- ✅ **CREATES** test users (Admin, Manager, Waiter, Customer)
- ❌ **DOES NOT DELETE** anything
- ✅ **PRESERVES** existing menu items
- ✅ **PRESERVES** existing orders
- ✅ **PRESERVES** existing customer data
- ✅ **IDEMPOTENT** - can be run multiple times safely

### Example

```bash
npm run seed
```

### Output

```
📝 SAFE MODE: Only creating/updating test users
   Existing products, orders, and other data will NOT be deleted

✅ SAFE MODE:
   • Existing menu items: PRESERVED
   • Existing orders: PRESERVED
   • Existing customers (non-test): PRESERVED
   • Only test users created/updated
```

### Use Cases

- ✅ First-time setup
- ✅ Adding test credentials without losing data
- ✅ Development environment refresh
- ✅ Adding seed data to existing database

---

## ⚠️ Reset Mode (Destructive)

**Command**: `npm run seed -- --reset`

### Behavior

- 🗑️ **DELETES ALL** data in:
  - Staff collection
  - Customer collection
  - Menu collection
  - Order collection
- ✅ **THEN CREATES** fresh test data
- ⚠️ **NOT IDEMPOTENT** - destructive operation

### Example

```bash
npm run seed -- --reset
```

### Output

```
⚠️  WARNING: Entering RESET mode - all collections will be wiped!
   Deleting: Staff, Customer, Menu, Order collections...

✅ All collections cleared
...
⚠️  RESET MODE APPLIED:
   ✅ All collections were wiped and recreated
```

### Use Cases

- ❌ Production environments (NEVER)
- ✅ Clean development restart
- ✅ Testing fresh installation
- ✅ Clearing corrupted data
- ✅ Resetting to known good state

### ⚠️ WARNING

**Only use `--reset` if you are absolutely certain you want to delete ALL data!**

---

## 📋 What Gets Seeded (Safe Mode)

### Staff Users Created

```
1. Admin User
   Email: admin@florencefoods.com
   Password: Admin123!
   Role: Admin

2. Manager Florence
   Email: manager@florencefoods.com
   Password: Manager123!
   Role: Manager

3. Waiter John
   Email: waiter@florencefoods.com
   Password: Waiter123!
   Role: Waiter
```

### Customer Users Created

```
1. Customer Alice
   Email: alice@customer.com
   Password: Customer123!
   Loyalty Points: 100

2. Customer Bob
   Email: bob@customer.com
   Password: Customer123!
   Loyalty Points: 50
```

---

## 🔄 Seeding Flow Diagram

### Safe Mode (Default)

```
Connect to MongoDB
    ↓
Check for --reset flag (NOT present)
    ↓
Print "SAFE MODE" message
    ↓
Attempt to create Staff users
  (Skip if already exist)
    ↓
Attempt to create Customer users
  (Skip if already exist)
    ↓
Print credentials
    ↓
Exit success
```

### Reset Mode

```
Connect to MongoDB
    ↓
Check for --reset flag (PRESENT)
    ↓
Print WARNING message
    ↓
DELETE Staff collection
DELETE Customer collection
DELETE Menu collection
DELETE Order collection
    ↓
Create Staff users (fresh)
    ↓
Create Customer users (fresh)
    ↓
Print credentials
    ↓
Exit success
```

---

## 💡 Best Practices

### Development Environment

```bash
# First setup
npm run seed

# Make changes, test...

# Need a clean state?
npm run seed -- --reset

# Add more test data without losing orders?
npm run seed
```

### Production Environment

```bash
# ✅ SAFE - Only for initial setup or adding test accounts
npm run seed

# ❌ NEVER use this in production
npm run seed -- --reset
```

### Data Preservation

**Safe mode will NOT delete:**

- Existing menu items
- Existing orders
- Existing customer records (except those with test emails)
- Any other collections

**Safe mode ONLY operates on:**

- Staff user creation (if not exists)
- Customer user creation (if not exists)

---

## 🧪 Testing the Seed Script

### Scenario 1: Fresh Database

```bash
# Database is empty
npm run seed

# Result:
# ✅ Creates 3 staff users
# ✅ Creates 2 customer users
# ✅ All credentials printed
```

### Scenario 2: Seed Already Ran

```bash
# First seed
npm run seed
# ✅ Creates users

# Second seed
npm run seed
# ⚠️ Shows "may already exist" messages
# ✅ But doesn't fail - idempotent!
```

### Scenario 3: Existing Menu Items

```bash
# You have menu items in database
Menu.count() → 50 items

# Safe seed
npm run seed

# Result:
# ✅ Test users created
# ✅ Menu items still there: 50 items
```

### Scenario 4: Reset Everything

```bash
# Database has:
# - 100 menu items
# - 50 orders
# - 10 customers

npm run seed -- --reset

# Result:
# ✅ All deleted
# ✅ Fresh test data created
# ✅ Starting from clean slate
```

---

## 🔧 Modifying Seed Data

### To Add More Test Users (Safe Mode)

Edit `backend/seed.js`:

```javascript
const staffUsers = [
    { /* existing admin */ },
    { /* existing manager */ },
    { /* existing waiter */ },
    // ADD YOUR NEW TEST USER HERE:
    {
        name: 'Supervisor Mike',
        email: 'supervisor@florencefoods.com',
        role: 'Manager',
        contact: '256704000004',
        password: 'Supervisor123!'
    }
];
```

Then run:

```bash
npm run seed
# ✅ New user created
# ✅ Existing users preserved
```

### To Add Initial Menu Data (Both Modes)

Create `seed-menu.js`:

```javascript
import Menu from './models/Menu.js';

const seedMenu = async () => {
    const menuItems = [
        { name: 'Burger', price: 5000, category: 'Main' },
        { name: 'Fries', price: 2000, category: 'Side' },
    ];
    
    if (shouldReset) {
        // Already deleted by main seed, just create
        await Menu.insertMany(menuItems);
    } else {
        // Check what exists, add what's missing
        for (const item of menuItems) {
            await Menu.findOneAndUpdate(
                { name: item.name },
                item,
                { upsert: true }
            );
        }
    }
};
```

---

## ⚠️ Important Notes

### Email Uniqueness

- The seed script respects unique email constraints
- If `admin@florencefoods.com` already exists, the seed will skip it
- This makes the script **idempotent** and **safe to run multiple times**

### Reset Mode Considerations

- ❌ **Never use in production** (unless you want to lose everything)
- ✅ Use only in **development/testing**
- ⚠️ Always have **backups** if using --reset
- 🔐 Requires explicit `--reset` flag (can't happen by accident)

### Safe Mode Guarantees

- ✅ No data loss
- ✅ Can run multiple times
- ✅ Skips duplicates gracefully
- ✅ Preserves all unrelated collections
- ✅ Production-safe

---

## 📞 Troubleshooting

### "Staff may already exist" message

**Problem**: Running seed multiple times  
**Solution**: This is normal! It means:

- User already exists
- Seed is idempotent (safe)
- Your data is preserved

### Seed hangs or times out

**Problem**: MongoDB not running  
**Solution**:

```bash
# Windows
Start-Service -Name "MongoDB"

# Or verify connection
npm run seed
```

### Want to add menu items without deleting?

**Problem**: Menu items not in seed  
**Solution**: Use safe mode - menu items are never touched!

```bash
npm run seed
# Menu items remain, users added
```

### Accidentally want to undo a reset?

**Solution**: Restore from backup (you have one, right? 😄)  
**Prevention**: Never use `--reset` in production!

---

## Summary

| Mode | Command | Data Deleted? | Use Case |
|------|---------|--------------|----------|
| **Safe** | `npm run seed` | No | Development, any environment, safe |
| **Reset** | `npm run seed -- --reset` | Yes (all) | Testing, clean slate only |

**Default behavior is SAFE - existing data is never deleted!**
