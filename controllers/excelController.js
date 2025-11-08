const sql = require('mssql');
const XLSX = require('xlsx');
const {connectDb} = require('../config/db'); // This should return your MSSQL pool connection

// ===============================
// ✅ Create Excel
// ===============================
exports.createExcel = async (req, res) => {
  try {
    const { folder_id } = req.params;
    const { excel_name } = req.body;
console.log('Request to create Excel:', { folder_id, excel_name });
    if (!excel_name) {
      return res.status(400).json({ error: 'Excel name is required' });
    }

    const pool = await connectDb();
    const org_id = req.query.org_id || req.user.org_id || req.user.id;

    // ✅ Step 1: Check if folder exists, active and not deleted
    const folderCheck = await pool.request()
      .input('folder_id', sql.Int, folder_id)
      .input('org_id', sql.Int, org_id)
      .query(`
        SELECT id FROM folders
        WHERE id = @folder_id
          AND org_id = @org_id
          AND deleted_at IS NULL
          AND active_status = 1
      `);

    if (folderCheck.recordset.length === 0) {
      return res.status(400).json({
        error: 'Invalid folder: either deleted or inactive for this organization.',
      });
    }

    // ✅ Step 2: Insert new Excel entry
    const result = await pool.request()
      .input('folder_id', sql.Int, folder_id)
      .input('excel_name', sql.NVarChar, excel_name)
      .input('created_by', sql.Int, org_id)
      .query(`
        INSERT INTO excels (folder_id, excel_name, created_by, created_at, active_status)
        OUTPUT INSERTED.id
        VALUES (@folder_id, @excel_name, @created_by, GETDATE(), 1)
      `);

    res.json({
      success: true,
      excel_id: result.recordset[0].id,
      message: 'Excel created successfully',
    });
  } catch (err) {
    console.error('❌ createExcel Error:', err);
    res.status(500).json({ error: 'Failed to create excel' });
  }
};

// ===============================
// ✅ Upload Excel Data
// ===============================
exports.uploadExcelData = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const pool = await connectDb();

    // Update Excel name to uploaded file name
    await pool.request()
      .input('excel_name', sql.NVarChar, fileName)
      .input('excel_id', sql.Int, excel_id)
      .query(`
        UPDATE excels SET excel_name = @excel_name, updated_at = GETDATE() WHERE id = @excel_id
      `);

    const workbook = XLSX.readFile(filePath);

    for (const sheetName of workbook.SheetNames) {
      const sheetInsert = await pool.request()
        .input('excel_id', sql.Int, excel_id)
        .input('sheet_name', sql.NVarChar, sheetName)
        .input('created_by', sql.Int, req.user.id)
        .query(`
          INSERT INTO sheets (excel_id, sheet_name, created_by, created_at)
          OUTPUT INSERTED.id
          VALUES (@excel_id, @sheet_name, @created_by, GETDATE())
        `);

      const sheet_id = sheetInsert.recordset[0].id;
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (data.length > 0) {
        const cols = Object.keys(data[0]);

        // Insert columns
        for (const col of cols) {
          await pool.request()
            .input('sheet_id', sql.Int, sheet_id)
            .input('column_name', sql.NVarChar, col)
            .input('data_type', sql.NVarChar, 'TEXT')
            .query(`
              INSERT INTO columns (sheet_id, column_name, data_type)
              VALUES (@sheet_id, @column_name, @data_type)
            `);
        }

        // Insert rows
        for (const row of data) {
          await pool.request()
            .input('sheet_id', sql.Int, sheet_id)
            .input('row_data', sql.NVarChar, JSON.stringify(row))
            .input('created_by', sql.Int, req.user.id)
            .query(`
              INSERT INTO rows (sheet_id, row_data, created_by)
              VALUES (@sheet_id, @row_data, @created_by)
            `);
        }
      }
    }

    res.json({ success: true, message: 'Excel uploaded successfully' });
  } catch (err) {
    console.error('❌ uploadExcelData Error:', err);
    res.status(500).json({ error: 'Failed to upload excel data' });
  }
};

// ===============================
// ✅ List Excels (optional filter: active/inactive)
// ===============================
exports.listExcels = async (req, res) => {
  try {
    const { folder_id } = req.params;
    const { status } = req.query;
    const pool = await connectDb();

    let query = `
      SELECT * FROM excels
      WHERE folder_id = @folder_id AND deleted_at IS NULL
    `;

    if (status === 'active') query += ' AND active_status = 1';
    else if (status === 'inactive') query += ' AND active_status = 0';

    const result = await pool.request()
      .input('folder_id', sql.Int, folder_id)
      .query(query);

    res.json({ success: true, excels: result.recordset });
  } catch (err) {
    console.error('❌ listExcels Error:', err);
    res.status(500).json({ error: 'Failed to list excels' });
  }
};

// ===============================
// ✅ Update Excel
// ===============================
exports.updateExcel = async (req, res) => {
  try {
    const { folder_id, excel_id } = req.params;
    const { excel_name, active_status } = req.body;
    const pool = await connectDb();

    const check = await pool.request()
      .input('excel_id', sql.Int, excel_id)
      .input('folder_id', sql.Int, folder_id)
      .query(`
        SELECT id FROM excels
        WHERE id = @excel_id AND folder_id = @folder_id AND deleted_at IS NULL
      `);

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Excel not found in this folder' });
    }

    const updates = [];
    if (excel_name) updates.push('excel_name = @excel_name');
    if (typeof active_status === 'boolean') updates.push('active_status = @active_status');
    updates.push('updated_at = GETDATE()');

    if (updates.length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    const request = pool.request()
      .input('excel_id', sql.Int, excel_id)
      .input('folder_id', sql.Int, folder_id);
    if (excel_name) request.input('excel_name', sql.NVarChar, excel_name);
    if (typeof active_status === 'boolean') request.input('active_status', sql.Bit, active_status ? 1 : 0);

    const query = `
      UPDATE excels
      SET ${updates.join(', ')}
      WHERE id = @excel_id AND folder_id = @folder_id
    `;

    await request.query(query);
    res.json({ success: true, message: 'Excel updated successfully' });
  } catch (err) {
    console.error('❌ updateExcel Error:', err);
    res.status(500).json({ error: 'Failed to update excel' });
  }
};

// ===============================
// ✅ Delete Excel (Soft Delete)
// ===============================
exports.deleteExcel = async (req, res) => {
  try {
    const { folder_id, excel_id } = req.params;
    const pool = await connectDb();

    const check = await pool.request()
      .input('excel_id', sql.Int, excel_id)
      .input('folder_id', sql.Int, folder_id)
      .query(`
        SELECT id FROM excels
        WHERE id = @excel_id AND folder_id = @folder_id AND deleted_at IS NULL
      `);

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Excel not found or already deleted' });
    }

    await pool.request()
      .input('excel_id', sql.Int, excel_id)
      .input('folder_id', sql.Int, folder_id)
      .query(`
        UPDATE excels
        SET deleted_at = GETDATE(), active_status = 0
        WHERE id = @excel_id AND folder_id = @folder_id
      `);

    res.json({ success: true, message: 'Excel deleted successfully' });
  } catch (err) {
    console.error('❌ deleteExcel Error:', err);
    res.status(500).json({ error: 'Failed to delete excel' });
  }
};
