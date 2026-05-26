# Seed Script Best Practices

## Your Question
> "Should our seed files wipe anything unrelated to what they are updating? Should our product listing be wiped if we are only seeding admins for example?"

## Answer: NO, They Should NOT Wipe Unrelated Data

### The Philosophy
**Seed scripts should be conservative and non-destructive by default.**

### Why Not Delete Unrelated Data?

1. **Data Safety**: Accidental data loss is catastrophic
2. **Flexibility**: Different use cases need different behaviors
3. **Composition**: Multiple seed scripts should work together without conflicts
4. **Reversibility**: Easier to add data than recover deleted data
5. **Development**: Developers need to test without fear of losing work

### Our Implementation

**By Default (Safe Mode)**:
```
✅ When you seed admins:
   - Admin users are created
   - Existing products are PRESERVED ✅
   - Existing orders are PRESERVED ✅
   - Existing customers are PRESERVED ✅

✅ When you seed products:
   - Products are created
   - Existing admins are PRESERVED ✅
   - Existing orders are PRESERVED ✅
   - Existing customers are PRESERVED ✅

✅ When you seed customers:
   - Customers are created
   - Existing admins are PRESERVED ✅
   - Existing products are PRESERVED ✅
   - Existing orders are PRESERVED ✅
```

**With Explicit --reset Flag (Destructive Mode)**:
```
⚠️  When you run seed -- --reset:
   - ALL collections are WIPED 🗑️
   - Fresh test data is created ✅
   - No data is preserved ⚠️
```

---

## Best Practices for Your Project

### 1. Default Behavior (Recommended)
```bash
npm run seed
# ✅ Safe - only adds test users
# ✅ Menu items untouched
# ✅ Orders untouched
# ✅ Customer data untouched
```

### 2. Multiple Seed Scripts

If you have multiple seed scripts:

```bash
# seed-users.js
npm run seed:users     # Only creates users, no deletions

# seed-products.js
npm run seed:products  # Only creates products, no deletions

# seed-all.js
npm run seed:all       # Creates everything, no deletions

# reset.js
npm run reset          # WIPES everything, then recreates
```

**Key Point**: Each script only creates its own entity type. Nothing is deleted unless you explicitly ask.

### 3. When You NEED to Delete

**Only do this with explicit user action:**

```bash
# Dangerous operations require explicit opt-in
npm run seed -- --reset              # Reset everything
npm run reset:users                  # Reset only users
npm run reset:products               # Reset only products
```

**Never** have destructive behavior as the default.

---

## Real-World Example

### Scenario 1: You have 100 menu items in the database

```bash
npm run seed
```

**Result**:
```
✅ Test users created
✅ 100 menu items still there
```

### Scenario 2: You have orders in the database

```bash
npm run seed
```

**Result**:
```
✅ Test users created
✅ All orders still there
```

### Scenario 3: You want a clean slate

```bash
npm run seed -- --reset
```

**Result**:
```
🗑️  All data deleted
✅ Fresh test data created
⚠️  Start from scratch
```

---

## Industry Standards

This is the standard approach used by:
- **Rails**: `rake db:seed` (additive)
- **Django**: `manage.py loaddata` (additive)
- **Laravel**: `php artisan migrate:seed` (additive)
- **Node.js**: Industry best practices (additive)

Most frameworks use additive seeds by default and require explicit reset commands for destructive operations.

---

## Our Implementation in Code

### Safe Mode Detection
```javascript
const shouldReset = process.argv.includes('--reset');

if (shouldReset) {
    // ONLY if --reset is explicitly passed
    await Staff.deleteMany({});
    await Customer.deleteMany({});
    await Menu.deleteMany({});
    await Order.deleteMany({});
} else {
    // DEFAULT: Safe additive mode
    // Create or skip if exists
    const staff = await Staff.create(data);
}
```

### Why This Works

1. **Default is safe**: No deletions unless you ask
2. **Explicit is dangerous**: Must actively opt-in to `--reset`
3. **Can't happen by accident**: Requires exact flag syntax
4. **Reversible**: Safe mode never needs rollback

---

## Recommendations for Your Project

### ✅ DO
- Default seed script adds only test data
- Preserve all unrelated collections
- Support multiple runs (idempotent)
- Document what each seed does

### ❌ DON'T
- Delete unrelated data by default
- Have destructive behavior without explicit flag
- Assume users want data loss
- Delete data without warning

### Example Good Practices
```javascript
// ✅ GOOD
npm run seed              // Additive, safe
npm run seed -- --reset   // Additive + reset, explicit

// ❌ BAD
npm run seed              // Wipes everything (no warning!)
npm run seed              // Deletes products while seeding admins
```

---

## Summary

**For Florence Foods:**

| Operation | Command | Behavior | Safe? |
|-----------|---------|----------|-------|
| Seed test users | `npm run seed` | Add users only | ✅ Yes |
| Seed products | `npm run seed:products` | Add products only | ✅ Yes |
| Seed everything | `npm run seed:all` | Add all, preserve rest | ✅ Yes |
| Full reset | `npm run seed -- --reset` | Delete all, then create | ⚠️ Intentional |

**Default is SAFE. Destructive actions require explicit flags.**

This ensures that:
- Your menu items are never accidentally deleted 🎯
- Your orders are never accidentally deleted 🎯
- Your customers are never accidentally deleted 🎯
- Data loss only happens when you explicitly ask for it ✅

---

## Questions This Answers

✅ "Should seed wipe products?" → No, by default (unless --reset)  
✅ "Should seed delete orders?" → No, by default (unless --reset)  
✅ "Can I run seed multiple times?" → Yes, safe mode is idempotent  
✅ "How do I do a full reset?" → `npm run seed -- --reset` (explicit)  
✅ "Is this production-safe?" → Yes, default behavior is safe  
