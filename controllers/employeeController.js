const { sql, connectDb } = require('../config/db');
const bcrypt = require('bcrypt');

// ===============================
// ✅ Create Employee
// ===============================
exports.createEmployee = async (req, res) => {
  try {
    const { org_id } = req.params;
    const { name, email, password, role } = req.body;
    const hash = password ? await bcrypt.hash(password, 10) : null;
    const pool = await connectDb();

    // 🔹 Check if organization exists
    const orgCheck = await pool.request()
      .input('org_id', sql.Int, org_id)
      .query('SELECT id FROM organizations WHERE id = @org_id');
    if (orgCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // 🔹 Validate role
    const allowedRoles = ['admin', 'employee'];
    const employeeRole = role || 'employee';
    if (!allowedRoles.includes(employeeRole)) {
      return res.status(400).json({ error: "Role must be either 'admin' or 'employee'" });
    }

    // 🔹 Check duplicate email in same org
    if (email) {
      const emailCheck = await pool.request()
        .input('email', sql.NVarChar, email)
        .input('org_id', sql.Int, org_id)
        .query(`
          SELECT id FROM employees 
          WHERE email = @email AND org_id = @org_id AND deleted_at IS NULL
        `);
      if (emailCheck.recordset.length > 0) {
        return res.status(409).json({ error: 'Employee email already exists in this organization' });
      }
    }

    // 🔹 Insert employee
    const result = await pool.request()
      .input('org_id', sql.Int, org_id)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email || null)
      .input('password', sql.NVarChar, hash)
      .input('role', sql.NVarChar, employeeRole)
      .input('is_verified', sql.Bit, 0)
      .input('active_status', sql.Bit, 1)
      .query(`
        INSERT INTO employees (org_id, name, email, password, role, is_verified, active_status)
        OUTPUT INSERTED.id
        VALUES (@org_id, @name, @email, @password, @role, @is_verified, @active_status)
      `);

    res.json({ success: true, employee_id: result.recordset[0].id });
  } catch (err) {
    if (err && (err.number === 2627 || err.number === 2601)) {
      return res.status(409).json({ error: 'Employee email must be unique' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

// ===============================
// ✅ List Employees
// ===============================
// ===============================
// ✅ List Employees with Status Filter
// ===============================
exports.listEmployees = async (req, res) => {
  try {
    const { org_id } = req.params;
    const { status } = req.query; // possible values: 'active', 'inactive'
    const pool = await connectDb();

    let query = `
      SELECT id, name, email, role, is_verified, active_status, created_at, updated_at
      FROM employees
      WHERE org_id = @org_id AND deleted_at IS NULL
    `;

    // 🔹 Apply status filter if provided
    if (status === 'active') {
      query += ' AND active_status = 1';
    } else if (status === 'inactive') {
      query += ' AND active_status = 0';
    }

    const result = await pool.request()
      .input('org_id', sql.Int, org_id)
      .query(query);

    res.json({
      success: true,
      filter: status || 'all',
      employees: result.recordset
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list employees' });
  }
};


// ===============================
// ✅ Update Employee
// ===============================
exports.updateEmployee = async (req, res) => {
  try {
    const { org_id, employee_id } = req.params;
    const { name, email, password, role, is_verified, active_status } = req.body;
    const pool = await connectDb();

    // 🔹 Check if org exists
    const orgCheck = await pool.request()
      .input('org_id', sql.Int, org_id)
      .query('SELECT id FROM organizations WHERE id = @org_id');
    if (orgCheck.recordset.length === 0)
      return res.status(404).json({ error: 'Organization not found' });

    // 🔹 Check if employee exists
    const empCheck = await pool.request()
      .input('employee_id', sql.Int, employee_id)
      .input('org_id', sql.Int, org_id)
      .query(`
        SELECT id FROM employees 
        WHERE id = @employee_id AND org_id = @org_id AND deleted_at IS NULL
      `);
    if (empCheck.recordset.length === 0)
      return res.status(404).json({ error: 'Employee not found in this organization' });

    // 🔹 Validate role
    const allowedRoles = ['admin', 'employee'];
    if (role && !allowedRoles.includes(role))
      return res.status(400).json({ error: "Role must be either 'admin' or 'employee'" });

    // 🔹 Check duplicate email
    if (email) {
      const emailCheck = await pool.request()
        .input('email', sql.NVarChar, email)
        .input('org_id', sql.Int, org_id)
        .input('employee_id', sql.Int, employee_id)
        .query(`
          SELECT id FROM employees 
          WHERE email = @email AND org_id = @org_id AND id != @employee_id AND deleted_at IS NULL
        `);
      if (emailCheck.recordset.length > 0)
        return res.status(409).json({ error: 'Employee email already exists in this organization' });
    }

    // 🔹 Build dynamic update query
    let updateFields = [];
    if (name) updateFields.push('name = @name');
    if (email) updateFields.push('email = @email');
    if (password) updateFields.push('password = @password');
    if (role) updateFields.push('role = @role');
    if (typeof is_verified === 'boolean') updateFields.push('is_verified = @is_verified');
    if (typeof active_status === 'boolean') updateFields.push('active_status = @active_status');
    updateFields.push('updated_at = GETDATE()');

    if (updateFields.length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    const query = `
      UPDATE employees
      SET ${updateFields.join(', ')}
      WHERE id = @employee_id AND org_id = @org_id
    `;

    const reqDb = pool.request()
      .input('employee_id', sql.Int, employee_id)
      .input('org_id', sql.Int, org_id);

    if (name) reqDb.input('name', sql.NVarChar, name);
    if (email) reqDb.input('email', sql.NVarChar, email);
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      reqDb.input('password', sql.NVarChar, hash);
    }
    if (role) reqDb.input('role', sql.NVarChar, role);
    if (typeof is_verified === 'boolean') reqDb.input('is_verified', sql.Bit, is_verified ? 1 : 0);
    if (typeof active_status === 'boolean') reqDb.input('active_status', sql.Bit, active_status ? 1 : 0);

    await reqDb.query(query);

    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err) {
    if (err && (err.number === 2627 || err.number === 2601))
      return res.status(409).json({ error: 'Employee email must be unique' });

    console.error(err);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

// ===============================
// ✅ Delete Employee (Soft Delete)
// ===============================
exports.deleteEmployee = async (req, res) => {
  try {
    const { org_id, employee_id } = req.params;
    const pool = await connectDb();

    // 🔹 Check if exists
    const empCheck = await pool.request()
      .input('employee_id', sql.Int, employee_id)
      .input('org_id', sql.Int, org_id)
      .query(`
        SELECT id FROM employees 
        WHERE id = @employee_id AND org_id = @org_id AND deleted_at IS NULL
      `);
    if (empCheck.recordset.length === 0)
      return res.status(404).json({ error: 'Employee not found or already deleted' });

    // 🔹 Soft delete and deactivate
    await pool.request()
      .input('employee_id', sql.Int, employee_id)
      .input('org_id', sql.Int, org_id)
      .query(`
        UPDATE employees
        SET deleted_at = GETDATE(),
            active_status = 0,
            updated_at = GETDATE()
        WHERE id = @employee_id AND org_id = @org_id
      `);

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

// ===========================================
// ✅ Activate / Deactivate Employee
// ===========================================
exports.toggleEmployeeStatus = async (req, res) => {
  try {
    const { org_id, employee_id } = req.params;
    const { active_status } = req.body; // expects true or false

    if (typeof active_status !== 'boolean') {
      return res.status(400).json({ error: "active_status must be true or false" });
    }

    const pool = await connectDb();

    // Check if organization exists
    const orgCheck = await pool.request()
      .input('org_id', sql.Int, org_id)
      .query('SELECT id FROM organizations WHERE id = @org_id');
    if (orgCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if employee exists
    const empCheck = await pool.request()
      .input('employee_id', sql.Int, employee_id)
      .input('org_id', sql.Int, org_id)
      .query('SELECT id FROM employees WHERE id = @employee_id AND org_id = @org_id AND deleted_at IS NULL');
    if (empCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Employee not found or already deleted' });
    }

    // Update active status
    await pool.request()
      .input('employee_id', sql.Int, employee_id)
      .input('org_id', sql.Int, org_id)
      .input('active_status', sql.Bit, active_status ? 1 : 0)
      .query('UPDATE employees SET active_status = @active_status, updated_at = GETDATE() WHERE id = @employee_id AND org_id = @org_id');

    res.json({
      success: true,
      message: active_status ? 'Employee activated successfully' : 'Employee deactivated successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update employee status' });
  }
};
