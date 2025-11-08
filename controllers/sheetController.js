const sql = require('mssql');
const db = require('../config/db');
const xlsx = require('xlsx'); // npm install xlsx
const fs = require('fs');
const path = require('path');

// ===============================
// 🧾 Create Sheet
// ===============================
exports.createSheet = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const { sheet_name } = req.body;

    if (!sheet_name) return res.status(400).json({ error: 'Sheet name is required' });

    const pool = await db.connectDb();
    const org_id = req.query.org_id || req.user.org_id || req.user.id;

    // Validate Excel and Org
    const excelCheck = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .input('org_id', sql.Int, org_id)
      .query(`
        SELECT e.id
        FROM excels e
        INNER JOIN folders f ON e.folder_id = f.id
        WHERE e.id = @excel_id
          AND e.deleted_at IS NULL
          AND f.deleted_at IS NULL
          AND f.org_id = @org_id
      `);

    if (excelCheck.recordset.length === 0)
      return res.status(400).json({ error: 'Invalid or deleted Excel file for this organization.' });

    // Check duplicate sheet
    const dup = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .input('sheet_name', sql.NVarChar, sheet_name)
      .query(`
        SELECT id FROM sheets
        WHERE excel_id=@excel_id AND LOWER(sheet_name)=LOWER(@sheet_name)
          AND deleted_at IS NULL
      `);
    if (dup.recordset.length)
      return res.status(400).json({ error: `A sheet named "${sheet_name}" already exists.` });

    // Insert sheet
    const sheetRes = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .input('sheet_name', sql.NVarChar, sheet_name)
      .input('created_by', sql.Int, org_id)
      .query(`
        INSERT INTO sheets (excel_id, sheet_name, created_by, created_at)
        OUTPUT INSERTED.id AS sheet_id
        VALUES (@excel_id, @sheet_name, @created_by, GETDATE())
      `);

    const sheet_id = sheetRes.recordset[0].sheet_id;

    // Create dynamic data table
    const tableName = `sheet_data_${sheet_id}`;
    const createTableSQL = `
      CREATE TABLE ${tableName} (
        id INT IDENTITY(1,1) PRIMARY KEY,
        row_data NVARCHAR(MAX),
        created_by INT,
        created_at DATETIME DEFAULT GETDATE()
      );
    `;
    await pool.request().query(createTableSQL);

    res.json({ success: true, message: 'Sheet created successfully', sheet_id, table_name: tableName });
  } catch (err) {
    console.error('❌ Error creating sheet:', err);
    res.status(500).json({ error: 'Failed to create sheet' });
  }
};

// ===============================
// 📤 Upload Sheet Data (JSON)
// ===============================
exports.uploadSheetData = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const { sheet_name, rows } = req.body;

    if (!sheet_name) return res.status(400).json({ error: 'sheet_name is required' });
    const pool = await sql.connect(db);

    const sheetRes = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .input('sheet_name', sql.NVarChar, sheet_name)
      .input('created_by', sql.Int, req.user.id)
      .query(`
        INSERT INTO sheets (excel_id, sheet_name, created_by, created_at)
        OUTPUT INSERTED.id AS sheet_id
        VALUES (@excel_id, @sheet_name, @created_by, GETDATE())
      `);

    const sheet_id = sheetRes.recordset[0].sheet_id;

    if (Array.isArray(rows) && rows.length > 0) {
      const cols = Object.keys(rows[0]);

      for (const c of cols) {
        await pool.request()
          .input('sheet_id', sql.Int, sheet_id)
          .input('column_name', sql.NVarChar, c)
          .input('data_type', sql.NVarChar, 'TEXT')
          .query(`INSERT INTO columns (sheet_id, column_name, data_type) VALUES (@sheet_id, @column_name, @data_type)`);
      }

      for (const row of rows) {
        await pool.request()
          .input('sheet_id', sql.Int, sheet_id)
          .input('row_data', sql.NVarChar, JSON.stringify(row))
          .input('created_by', sql.Int, req.user.id)
          .query(`INSERT INTO rows (sheet_id, row_data, created_by, created_at) VALUES (@sheet_id, @row_data, @created_by, GETDATE())`);
      }
    }

    res.json({ success: true, message: 'Sheet uploaded successfully', sheet_id });
  } catch (err) {
    console.error('❌ uploadSheetData Error:', err);
    res.status(500).json({ error: 'Failed to upload sheet data' });
  }
};

// ===============================
// 📦 Upload Excel File (Bulk)
// ===============================
exports.uploadExcelFile = async (req, res) => {
  try {
    const { excel_id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No Excel file uploaded' });

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const pool = await db.connectDb();

    const createdSheets = [];

    for (const sheetName of sheetNames) {
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      // Step 1: Create sheet entry
      const sheetRes = await pool
        .request()
        .input('excel_id', sql.Int, excel_id)
        .input('sheet_name', sql.NVarChar, sheetName)
        .input('created_by', sql.Int, req.user.id)
        .query(`
          INSERT INTO sheets (excel_id, sheet_name, created_by, created_at)
          OUTPUT INSERTED.id AS sheet_id
          VALUES (@excel_id, @sheet_name, @created_by, GETDATE())
        `);

      const sheet_id = sheetRes.recordset[0].sheet_id;
      const tableName = `sheet_data_${sheet_id}`;

      // Step 2: Create dynamic table
      await pool.request().query(`
        CREATE TABLE ${tableName} (
          id INT IDENTITY(1,1) PRIMARY KEY,
          row_data NVARCHAR(MAX),
          created_by INT,
          created_at DATETIME DEFAULT GETDATE()
        );
      `);

      // Step 3: Insert rows
      for (const row of data) {
        await pool.request()
          .input('sheet_id', sql.Int, sheet_id)
          .input('row_data', sql.NVarChar, JSON.stringify(row))
          .input('created_by', sql.Int, req.user.id)
          .query(`INSERT INTO ${tableName} (row_data, created_by) VALUES (@row_data, @created_by)`);
      }

      createdSheets.push({ sheet_name: sheetName, sheet_id, table_name: tableName, rows: data.length });
    }

    fs.unlinkSync(filePath); // cleanup temp file
    res.json({ success: true, message: 'Excel uploaded successfully', sheets: createdSheets });
  } catch (err) {
    console.error('❌ uploadExcelFile Error:', err);
    res.status(500).json({ error: 'Failed to upload Excel file' });
  }
};

// ===============================
// 📋 List, Update, Delete same as before
// ===============================
// (listSheets, updateSheet, deleteSheet unchanged)
exports.listSheets = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const pool = await sql.connect(db);

    const sheetsResult = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .query(`
        SELECT id, sheet_name, created_by, created_at
        FROM sheets
        WHERE excel_id = @excel_id AND deleted_at IS NULL
      `);

    const sheets = sheetsResult.recordset;

    const sheetData = await Promise.all(
      sheets.map(async (sheet) => {
        const columnsResult = await pool
          .request()
          .input('sheet_id', sql.Int, sheet.id)
          .query(`
            SELECT id, column_name, data_type
            FROM columns
            WHERE sheet_id = @sheet_id
          `);
        return { ...sheet, columns: columnsResult.recordset };
      })
    );

    res.json({ success: true, sheets: sheetData });
  } catch (err) {
    console.error('Error listing sheets:', err);
    res.status(500).json({ error: 'Failed to list sheets' });
  }
};


// ===============================
// ✏️ Update Sheet
// ===============================
exports.updateSheet = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const { sheet_name } = req.body;

    if (!sheet_name) {
      return res.status(400).json({ error: 'sheet_name is required' });
    }

    const pool = await sql.connect(db);
    const result = await pool
      .request()
      .input('sheet_id', sql.Int, sheet_id)
      .input('sheet_name', sql.NVarChar, sheet_name)
      .query(`
        UPDATE sheets
        SET sheet_name = @sheet_name, updated_at = GETDATE()
        WHERE id = @sheet_id AND deleted_at IS NULL
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Sheet not found or already deleted' });
    }

    res.json({ success: true, message: 'Sheet updated successfully' });
  } catch (err) {
    console.error('Error updating sheet:', err);
    res.status(500).json({ error: 'Failed to update sheet' });
  }
};

// ===============================
// 🗑️ Delete Sheet (Soft Delete)
// ===============================
exports.deleteSheet = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const pool = await sql.connect(db);

    const result = await pool
      .request()
      .input('sheet_id', sql.Int, sheet_id)
      .query(`
        UPDATE sheets
        SET deleted_at = GETDATE()
        WHERE id = @sheet_id AND deleted_at IS NULL
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Sheet not found or already deleted' });
    }

    res.json({ success: true, message: 'Sheet deleted successfully' });
  } catch (err) {
    console.error('Error deleting sheet:', err);
    res.status(500).json({ error: 'Failed to delete sheet' });
  }
};
