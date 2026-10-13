const asyncHandler = require('express-async-handler');
const Employee     = require('../models/Employee');
const { DEPARTMENTS } = require('../models/Employee');
// ── Auto employee ID ──────────────────────────────────────────────────
const generateEmployeeId = async () => {
  const count = await Employee.countDocuments();
  return `EMP-${String(count + 1).padStart(4, '0')}`;
};

// ── GET /api/employees ────────────────────────────────────────────────
const getEmployees = asyncHandler(async (req, res) => {
  const { department, status, search } = req.query;
  const filter = { deletedAt: null };

  if (department) filter.department = department;
  if (status)     filter.status     = status;
  if (search) {
    const q = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ firstName: q }, { lastName: q }, { employeeId: q }, { position: q }];
  }

  const employees = await Employee.find(filter).sort({ department: 1, firstName: 1 }).lean();
  res.json(employees);
});
// ── GET /api/employees/departments ────────────────────────────────────
const getDepartments = asyncHandler(async (req, res) => {
  res.json(DEPARTMENTS);
});

// ── POST /api/employees ───────────────────────────────────────────────
const createEmployee = asyncHandler(async (req, res) => {
  const { firstName, lastName, department, position, phone, email, hireDate, status, notes, employeeId } = req.body;

  if (!firstName || !lastName) {
    res.status(400); throw new Error('First name and last name are required.');
  }

  const emp = await Employee.create({
    employeeId:  employeeId || (await generateEmployeeId()),
    firstName:   firstName.trim(),
    lastName:    lastName.trim(),
    department:  department || 'Other',
    position:    position   || '',
    phone:       phone      || '',
    email:       email      || '',
    hireDate:    hireDate   ? new Date(hireDate) : null,
    status:      status     || 'active',
    notes:       notes      || '',
  });

  res.status(201).json(emp);
});

// ── PUT /api/employees/:id ────────────────────────────────────────────
const updateEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp || emp.deletedAt) { res.status(404); throw new Error('Employee not found'); }

  const fields = ['firstName','lastName','department','position','phone','email','hireDate','status','notes','employeeId'];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      emp[f] = f === 'hireDate' ? (req.body[f] ? new Date(req.body[f]) : null) : req.body[f];
    }
  });

  await emp.save();
  res.json(emp);
});

// ── DELETE /api/employees/:id  (soft delete) ──────────────────────────
const deleteEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp || emp.deletedAt) { res.status(404); throw new Error('Employee not found'); }

  emp.deletedAt = new Date();
  emp.deletedBy = req.user?.name || 'System';
  await emp.save();
  res.json({ message: 'Employee removed.' });
});

module.exports = { getEmployees, getDepartments, createEmployee, updateEmployee, deleteEmployee };
