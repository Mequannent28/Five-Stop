const asyncHandler = require('express-async-handler');
const XLSX = require('xlsx');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const { invalidateDashboardCache } = require('./dashboardController');

// GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = { isActive: true };
  if (search) filter.name = { $regex: search, $options: 'i' };

  const products = await Product.find(filter)
    .populate('ingredients.material', 'name unit unitCost')
    .sort({ createdAt: -1 })
    .lean();

  const mapped = products.map((p) => ({
    ...p,
    recipeCost: (p.ingredients || []).reduce((sum, ing) => {
      const unitCost = ing.material?.unitCost ?? 0;
      return sum + unitCost * (ing.quantity || 0);
    }, 0),
  }));

  res.json(mapped);
});

// GET /api/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('ingredients.material', 'name unit unitCost');
  if (!product) { res.status(404); throw new Error('Product not found'); }
  res.json(product);
});

// POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const { name, category, description, sellingPrice, ingredients, code } = req.body;
  const product = await Product.create({ code, name, category, description, sellingPrice, ingredients });
  const populated = await product.populate('ingredients.material', 'name unit unitCost');
  invalidateDashboardCache();
  res.status(201).json(populated);
});


// PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }

  const { name, category, description, sellingPrice, ingredients } = req.body;
  product.name = name ?? product.name;
  product.category = category ?? product.category;
  product.description = description ?? product.description;
  product.sellingPrice = sellingPrice ?? product.sellingPrice;
  product.ingredients = ingredients ?? product.ingredients;

  const updated = await product.save();
  const populated = await updated.populate('ingredients.material', 'name unit unitCost');
  invalidateDashboardCache();
  res.json(populated);
});

// DELETE /api/products/:id  (soft delete)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  product.isActive = false;
  await product.save();
  invalidateDashboardCache();
  res.json({ message: 'Product removed' });
});


// DELETE /api/products/bulk  (bulk soft delete)
const bulkDeleteProducts = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) { res.status(400); throw new Error('No ids provided'); }
  await Product.updateMany({ _id: { $in: ids } }, { isActive: false });
  invalidateDashboardCache();
  res.json({ message: `${ids.length} product(s) deleted` });
});


// GET /api/products/export/excel
// Exports in the Five Stop format:
// Code | Name | UOM | Child Category | Parent Category | Default Value | Default Tax | Created On | State
const exportProductsExcel = asyncHandler(async (req, res) => {
  const products = await Product.find({ isActive: true })
    .populate('ingredients.material', 'name unit unitCost')
    .sort({ createdAt: 1 });

  const rows = products.map((p, i) => ({
    'Code': p.code || `P-${String(i + 1).padStart(4, '0')}`,
    'Name': p.name,
    'UOM': p.uom || 'Pcs',
    'Child Category': p.category || '',
    'Parent Category': p.parentCategory || 'FOOD',
    'Default Value': p.sellingPrice ?? 0,
    'Default Tax': 1,
    'Created On': p.createdAt ? new Date(p.createdAt).toISOString() : '',
    'State': p.isActive ? 'Active' : 'Inactive',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [12, 30, 6, 18, 16, 14, 12, 22, 8].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /api/products/import/excel
// Accepts the Five Stop format:
// Code | Name | UOM | Child Category | Parent Category | Default Value | Default Tax | Created On | State
const importProductsExcel = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Pre-filter valid rows — only skip truly empty names and the "Count:" summary row
  const validRows = rows.filter(row => {
    const name = String(row['Name'] || row['Product Name'] || '').trim();
    if (!name) return false;
    // Skip the Excel summary row "Count: 203" etc.
    if (/^Count:/i.test(name)) return false;
    // Skip rows where Name is literally a header repeat
    if (name.toLowerCase() === 'name') return false;
    return true;
  });

  const total   = validRows.length;
  let created   = 0;
  let updated   = 0;
  let skipped   = 0;
  const errors  = [];

  // Use SSE (Server-Sent Events) to stream progress back to client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'start', total });

  // Track which DB _ids have already been updated in THIS import run.
  // If the same _id is matched again (duplicate row in Excel), we create a NEW product.
  const processedIds = new Set();

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];

    const name = String(row['Name'] || row['Product Name'] || '').trim();
    // Normalize code — strip trailing dashes/spaces (source system quirk)
    const code = String(row['Code'] || '').trim().replace(/-+$/, '');

    const data = {
      name,
      code,
      uom:            String(row['UOM']             || 'Pcs').trim(),
      category:       String(row['Child Category']  || row['Category'] || 'General').trim(),
      parentCategory: String(row['Parent Category'] || 'FOOD').trim(),
      sellingPrice:   Number(row['Default Value']   ?? row['Selling Price'] ?? 0) || 0,
      description:    String(row['Description']     || '').trim(),
    };

    try {
      let existing = null;

      // 1️⃣ Match by normalized Code (exact, case-insensitive)
      if (code) {
        const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Also try matching the code with trailing dash (stored format)
        existing = await Product.findOne({
          code: { $regex: `^${escapedCode}-?$`, $options: 'i' },
        });
        // Only use this match if it hasn't been processed already
        if (existing && processedIds.has(existing._id.toString())) {
          existing = null; // Force create — this DB record was already updated this run
        }
      }

      // 2️⃣ Fall back to exact name match (only if no code match)
      if (!existing) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const byName = await Product.findOne({ name: { $regex: `^${escapedName}$`, $options: 'i' } });
        // Only use name match if this record hasn't been updated yet this run
        if (byName && !processedIds.has(byName._id.toString())) {
          existing = byName;
        }
      }

      if (existing) {
        // Update existing record — preserve ingredients
        existing.name           = data.name;
        existing.code           = data.code || existing.code;
        existing.uom            = data.uom;
        existing.category       = data.category;
        existing.parentCategory = data.parentCategory;
        existing.sellingPrice   = data.sellingPrice;
        existing.description    = data.description || existing.description;
        existing.isActive       = true;
        await existing.save();
        processedIds.add(existing._id.toString()); // Mark as processed
        updated++;
      } else {
        // No match found (or already updated this run) — create a brand-new product
        const created_ = await Product.create({ ...data, ingredients: [] });
        processedIds.add(created_._id.toString());
        created++;
      }
    } catch (err) {
      errors.push(`Row ${i + 1} "${name}": ${err.message}`);
      skipped++;
    }

    // Send progress every row
    send({
      type:     'progress',
      current:  i + 1,
      total,
      percent:  Math.round(((i + 1) / total) * 100),
      created,
      updated,
      skipped,
    });
  }

  invalidateDashboardCache();
  send({ type: 'done', created, updated, skipped, errors, total });
  res.end();
});


module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, bulkDeleteProducts, exportProductsExcel, importProductsExcel };
