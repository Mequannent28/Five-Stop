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

// DELETE /api/products/:id  (soft delete → recycle bin)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  product.isActive    = false;
  product.deletedAt   = new Date();
  product.deletedBy   = req.user?.name || 'System';
  product.deletedFrom = 'products';
  await product.save();
  invalidateDashboardCache();
  res.json({ message: 'Product moved to recycle bin.' });
});

// DELETE /api/products/bulk  (bulk soft delete)
const bulkDeleteProducts = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) { res.status(400); throw new Error('No ids provided'); }
  await Product.updateMany(
    { _id: { $in: ids } },
    { isActive: false, deletedAt: new Date(), deletedBy: req.user?.name || 'System', deletedFrom: 'products' }
  );
  invalidateDashboardCache();
  res.json({ message: `${ids.length} product(s) moved to recycle bin.` });
});

// POST /api/products/:id/restore
const restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  product.isActive    = true;
  product.deletedAt   = null;
  product.deletedBy   = null;
  product.deletedFrom = null;
  await product.save();
  invalidateDashboardCache();
  res.json({ message: 'Product restored.', product });
});

// DELETE /api/products/:id/permanent
const permanentDeleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  await product.deleteOne();
  invalidateDashboardCache();
  res.json({ message: 'Product permanently deleted.' });
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


// GET /api/products/export/recipe-template
// Downloads an Excel workbook pre-filled with all active products and their current recipes.
// Users edit this file and re-upload it to bulk-set ingredients.
// Format per row: Product Code | Product Name | Ingredient Name | Quantity | Unit
const exportRecipeTemplate = asyncHandler(async (req, res) => {
  const products = await Product.find({ isActive: true })
    .populate('ingredients.material', 'name unit')
    .sort({ name: 1 });

  const rows = [];

  for (const p of products) {
    if (p.ingredients && p.ingredients.length > 0) {
      for (const ing of p.ingredients) {
        rows.push({
          'Product Code':    p.code || '',
          'Product Name':    p.name,
          'Ingredient Name': ing.material?.name || '',
          'Quantity':        ing.quantity,
          'Unit':            ing.material?.unit || '',
        });
      }
    } else {
      // Include products with no recipe so user can easily add one
      rows.push({
        'Product Code':    p.code || '',
        'Product Name':    p.name,
        'Ingredient Name': '',
        'Quantity':        '',
        'Unit':            '',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [14, 28, 26, 10, 10].map((w) => ({ wch: w }));

  // Add a bright-yellow Instructions sheet so users know the format
  const instructions = [
    { 'HOW TO USE THIS TEMPLATE': '1. Do NOT rename or reorder columns.' },
    { 'HOW TO USE THIS TEMPLATE': '2. "Product Code" OR "Product Name" must match an existing product.' },
    { 'HOW TO USE THIS TEMPLATE': '3. "Ingredient Name" must exactly match a Raw Material name in the system.' },
    { 'HOW TO USE THIS TEMPLATE': '4. "Quantity" is the amount of the ingredient per 1 unit of the product.' },
    { 'HOW TO USE THIS TEMPLATE': '5. "Unit" is informational — the system reads the unit from the raw material.' },
    { 'HOW TO USE THIS TEMPLATE': '6. To REPLACE a product\'s entire recipe: list all ingredients in consecutive rows.' },
    { 'HOW TO USE THIS TEMPLATE': '7. Leave "Ingredient Name" blank to clear / skip that product\'s recipe.' },
    { 'HOW TO USE THIS TEMPLATE': '8. Save as .xlsx and use the "Import Recipes" button in the Products page.' },
  ];
  const wsInfo = XLSX.utils.json_to_sheet(instructions);
  wsInfo['!cols'] = [{ wch: 90 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Recipes');
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="recipe_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});


// POST /api/products/import/recipes
// Accepts the recipe template Excel file and bulk-updates product ingredients.
// Rows are grouped by Product Code / Name; all rows for the same product
// collectively REPLACE that product's entire ingredient list.
const importRecipesExcel = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }

  const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws   = wb.Sheets[wb.SheetNames[0]]; // always read first sheet
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Filter out blank / header rows
  const validRows = rows.filter((r) => {
    const name = String(r['Product Name'] || '').trim();
    const code = String(r['Product Code'] || '').trim();
    return name || code;
  });

  const total  = validRows.length;
  let updated  = 0;
  let skipped  = 0;
  const errors = [];

  // Stream progress via SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: 'start', total });

  // Pre-load all active raw materials once (name → ObjectId map, case-insensitive)
  const allMaterials = await RawMaterial.find({ isActive: { $ne: false } }).select('name unit').lean();
  const materialMap  = new Map(allMaterials.map((m) => [m.name.trim().toLowerCase(), m]));

  // Group rows by product identifier (code takes precedence over name)
  // Map: productKey → { code, name, ingredientRows[] }
  const productGroups = new Map();
  for (const row of validRows) {
    const code = String(row['Product Code'] || '').trim();
    const name = String(row['Product Name'] || '').trim();
    const key  = code || name.toLowerCase();
    if (!productGroups.has(key)) {
      productGroups.set(key, { code, name, rows: [] });
    }
    productGroups.get(key).rows.push(row);
  }

  let processed = 0;
  for (const [, group] of productGroups) {
    const { code, name, rows: groupRows } = group;

    try {
      // Resolve the product
      let product = null;
      if (code) {
        const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        product = await Product.findOne({ code: { $regex: `^${escaped}-?$`, $options: 'i' }, isActive: true });
      }
      if (!product && name) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        product = await Product.findOne({ name: { $regex: `^${escaped}$`, $options: 'i' }, isActive: true });
      }

      if (!product) {
        errors.push(`Product not found: "${code || name}" — skipped`);
        skipped += groupRows.length;
        processed += groupRows.length;
        send({ type: 'progress', current: processed, total, percent: Math.round((processed / total) * 100), updated, skipped });
        continue;
      }

      // Build ingredient array from all rows for this product
      const ingredients = [];
      for (const row of groupRows) {
        const ingName = String(row['Ingredient Name'] || '').trim();
        if (!ingName) continue; // blank ingredient = skip row (not an error)

        const qty = parseFloat(row['Quantity']);
        if (!qty || qty <= 0) {
          errors.push(`Row for "${product.name}" — ingredient "${ingName}": invalid quantity "${row['Quantity']}"`);
          continue;
        }

        const mat = materialMap.get(ingName.toLowerCase());
        if (!mat) {
          errors.push(`Row for "${product.name}" — raw material "${ingName}" not found in system`);
          continue;
        }

        // Avoid duplicate ingredients for the same material in the same product
        if (!ingredients.find((i) => i.material.toString() === mat._id.toString())) {
          ingredients.push({ material: mat._id, quantity: qty });
        }
      }

      // Replace the product's ingredient list
      product.ingredients = ingredients;
      await product.save();
      updated++;
    } catch (err) {
      errors.push(`"${code || name}": ${err.message}`);
      skipped++;
    }

    processed += groupRows.length;
    send({
      type:    'progress',
      current: processed,
      total,
      percent: Math.round((processed / total) * 100),
      updated,
      skipped,
    });
  }

  invalidateDashboardCache();
  send({ type: 'done', updated, skipped, errors, total: productGroups.size });
  res.end();
});


module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, bulkDeleteProducts, restoreProduct, permanentDeleteProduct, exportProductsExcel, importProductsExcel, exportRecipeTemplate, importRecipesExcel };
