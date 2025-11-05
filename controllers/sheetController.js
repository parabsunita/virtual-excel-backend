const sql = require('mssql');
const db = require('../config/db'); // your MSSQL connection config

// ===============================
// 🧾 Create Sheet
// ===============================
exports.createSheet = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const { sheet_name } = req.body;

    if (!sheet_name) {
      return res.status(400).json({ error: 'Sheet name is required' });
    }

    const pool = await db.connectDb();
    const org_id = req.query.org_id || req.user.org_id || req.user.id;

    // ✅ Step 1: Validate Excel file and organization
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

    if (excelCheck.recordset.length === 0) {
      return res.status(400).json({
        error: 'Invalid or deleted Excel file for this organization.',
      });
    }

    // ✅ Step 2: Check for duplicate sheet name in same Excel
    const duplicateCheck = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .input('sheet_name', sql.NVarChar, sheet_name)
      .query(`
        SELECT id FROM sheets
        WHERE excel_id = @excel_id
          AND LOWER(sheet_name) = LOWER(@sheet_name)
          AND deleted_at IS NULL
      `);

    if (duplicateCheck.recordset.length > 0) {
      return res.status(400).json({
        error: `A sheet named "${sheet_name}" already exists under this Excel.`,
      });
    }

    // ✅ Step 3: Insert new sheet
    const sheetResult = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .input('sheet_name', sql.NVarChar, sheet_name)
      .input('created_by', sql.Int, org_id)
      .query(`
        INSERT INTO sheets (excel_id, sheet_name, created_by, created_at)
        OUTPUT INSERTED.id AS sheet_id
        VALUES (@excel_id, @sheet_name, @created_by, GETDATE())
      `);

    const sheet_id = sheetResult.recordset[0].sheet_id;

    // ✅ Step 4: Create a dynamic table for this sheet
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

    // ✅ Step 5: Return success response
    res.json({
      success: true,
      message: 'Sheet created successfully, and table initialized.',
      sheet_id,
      table_name: tableName,
    });
  } catch (err) {
    console.error('❌ Error creating sheet and table:', err);
    res.status(500).json({ error: 'Failed to create sheet or its table' });
  }
};

// ===============================
// 📤 Upload Sheet Data
// ===============================
exports.uploadSheetData = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const { sheet_name, rows } = req.body;

    if (!sheet_name) return res.status(400).json({ error: 'sheet_name is required' });

    const pool = await sql.connect(db);

    // Create new sheet
    const sheetResult = await pool
      .request()
      .input('excel_id', sql.Int, excel_id)
      .input('sheet_name', sql.NVarChar, sheet_name)
      .input('created_by', sql.Int, req.user.id)
      .query(`
        INSERT INTO sheets (excel_id, sheet_name, created_by, created_at)
        OUTPUT INSERTED.id AS sheet_id
        VALUES (@excel_id, @sheet_name, @created_by, GETDATE())
      `);

    const sheet_id = sheetResult.recordset[0].sheet_id;

    // If rows are provided
    if (Array.isArray(rows) && rows.length > 0) {
      const cols = Object.keys(rows[0]);

      // Insert columns
      for (const c of cols) {
        await pool
          .request()
          .input('sheet_id', sql.Int, sheet_id)
          .input('column_name', sql.NVarChar, c)
          .input('data_type', sql.NVarChar, 'TEXT')
          .query(`
            INSERT INTO columns (sheet_id, column_name, data_type)
            VALUES (@sheet_id, @column_name, @data_type)
          `);
      }

      // Insert rows
      for (const row of rows) {
        await pool
          .request()
          .input('sheet_id', sql.Int, sheet_id)
          .input('row_data', sql.NVarChar, JSON.stringify(row))
          .input('created_by', sql.Int, req.user.id)
          .query(`
            INSERT INTO rows (sheet_id, row_data, created_by, created_at)
            VALUES (@sheet_id, @row_data, @created_by, GETDATE())
          `);
      }
    }

    res.json({ success: true, message: 'Sheet uploaded successfully', sheet_id });
  } catch (err) {
    console.error('Error uploading sheet data:', err);
    res.status(500).json({ error: 'Failed to upload sheet data' });
  }
};

// ===============================
// 📋 List Sheets under Excel
// ===============================
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
