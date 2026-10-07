// Seeds an initial admin user and a few sample records so the dashboard isn't empty.
// Run with: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Supplier = require('./models/Supplier');
const RawMaterial = require('./models/RawMaterial');

const run = async () => {
  await connectDB();

  const adminExists = await User.findOne({ email: 'admin@hotel.com' });
  if (!adminExists) {
    await User.create({
      name: 'Hotel Admin',
      email: 'admin@hotel.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log('Created default admin -> admin@hotel.com / admin123');
  } else {
    console.log('Admin already exists, skipping.');
  }

  const managerExists = await User.findOne({ email: 'manager@hotel.com' });
  if (!managerExists) {
    await User.create({
      name: 'Hotel Manager',
      email: 'manager@hotel.com',
      password: 'admin123',
      role: 'manager',
    });
    console.log('Created default manager -> manager@hotel.com / admin123');
  } else {
    console.log('Manager already exists, skipping.');
  }

  const storekeeperExists = await User.findOne({ email: 'storekeeper@hotel.com' });
  if (!storekeeperExists) {
    await User.create({
      name: 'Store Keeper',
      email: 'storekeeper@hotel.com',
      password: 'admin123',
      role: 'storekeeper',
    });
    console.log('Created default storekeeper -> storekeeper@hotel.com / admin123');
  } else {
    console.log('Storekeeper already exists, skipping.');
  }

  const supplierCount = await Supplier.countDocuments();
  if (supplierCount === 0) {
    await Supplier.insertMany([
      { name: 'Green Valley Farms', category: 'Produce', contactPerson: 'Abel Tesfaye', phone: '+251911000111' },
      { name: 'Addis Meat Suppliers', category: 'Meat & Poultry', contactPerson: 'Sara Girma', phone: '+251911000222' },
      { name: 'Blue Nile Beverages', category: 'Beverages', contactPerson: 'Yonas Bekele', phone: '+251911000333' },
    ]);
    console.log('Seeded sample suppliers.');
  }

  const materialCount = await RawMaterial.countDocuments();
  if (materialCount === 0) {
    await RawMaterial.insertMany([
      { name: 'Basmati Rice', category: 'Grains', unit: 'kg', currentStock: 120, reorderLevel: 30, unitCost: 85 },
      { name: 'Chicken Breast', category: 'Meat & Poultry', unit: 'kg', currentStock: 18, reorderLevel: 20, unitCost: 320 },
      { name: 'Cooking Oil', category: 'Pantry', unit: 'ltr', currentStock: 40, reorderLevel: 15, unitCost: 210 },
      { name: 'Fresh Tomatoes', category: 'Produce', unit: 'kg', currentStock: 8, reorderLevel: 15, unitCost: 45 },
      { name: 'Bottled Water 500ml', category: 'Beverages', unit: 'pcs', currentStock: 300, reorderLevel: 100, unitCost: 8 },
      { name: 'Bath Towels', category: 'Housekeeping', unit: 'pcs', currentStock: 5, reorderLevel: 20, unitCost: 150 },
    ]);
    console.log('Seeded sample raw materials.');
  }

  console.log('Seeding complete.');
  process.exit();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
