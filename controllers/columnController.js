const db = require('../config/db');
const sql = require('mssql');

/**
 * ✅ Add New Columns
 */
exports.addColumn = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const { columns } = req.body; // Expecting array: [{ column_name, data_type }]

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Columns array is required.' });
    }

    const pool = await db.connectDb();

    // ✅ Validate that sheet exists
    const sheetCheck = await pool
      .request()
      .input('sheet_id', sql.Int, sheet_id)
      .query(`
        SELECT s.id
        FROM sheets s
        INNER JOIN excels e ON s.excel_id = e.id
        INNER JOIN folders f ON e.folder_id = f.id
        WHERE s.id = @sheet_id
          AND s.deleted_at IS NULL
          AND e.deleted_at IS NULL
          AND f.deleted_at IS NULL
      `);

    if (sheetCheck.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid or deleted sheet.' });
    }

    const tableName = `sheet_data_${sheet_id}`;

    // ✅ Check existing columns for duplicates
    const existingColsResult = await pool
      .request()
      .input('sheet_id', sql.Int, sheet_id)
      .query(`SELECT LOWER(column_name) AS name FROM columns WHERE sheet_id = @sheet_id AND deleted_at IS NULL`);

    const existingCols = existingColsResult.recordset.map((r) => r.name);

    const newCols = [];
    for (const col of columns) {
      const name = col.column_name?.trim();
      if (!name) continue;

      if (existingCols.includes(name.toLowerCase())) {
        console.warn(`⚠️ Skipping duplicate column: ${name}`);
        continue;
      }

      const type = (col.data_type || 'NVARCHAR(MAX)').toUpperCase();

      // ✅ Add column to table
      const alterQuery = `ALTER TABLE ${tableName} ADD [${name}] ${type};`;
      await pool.request().query(alterQuery);

      // ✅ Insert metadata
      await pool
        .request()
        .input('sheet_id', sql.Int, sheet_id)
        .input('column_name', sql.NVarChar, name)
        .input('data_type', sql.NVarChar, type)
        .query(`
          INSERT INTO columns (sheet_id, column_name, data_type, created_at)
          VALUES (@sheet_id, @column_name, @data_type, GETDATE())
        `);

      newCols.push({ column_name: name, data_type: type });
    }

    if (newCols.length === 0) {
      return res.status(400).json({ error: 'No valid or new columns added.' });
    }

    res.json({
      success: true,
      message: 'Columns added successfully.',
      added_columns: newCols,
    });
  } catch (err) {
    console.error('❌ Error adding columns:', err);
    res.status(500).json({ error: 'Failed to add columns' });
  }
};

/**
 * ✅ List Columns
 */
exports.listColumns = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const pool = await db.connectDb();

    const result = await pool
      .request()
      .input('sheet_id', sql.Int, sheet_id)
      .query(`
        SELECT * FROM columns 
        WHERE sheet_id = @sheet_id AND deleted_at IS NULL
        ORDER BY id ASC
      `);

    res.json({ success: true, columns: result.recordset });
  } catch (err) {
    console.error('❌ Error listing columns:', err);
    res.status(500).json({ error: 'Failed to list columns' });
  }
};

/**
 * ✅ Edit / Update Existing Columns
 */
exports.updateColumns = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const { columns } = req.body; // Expecting array: [{ id, column_name, data_type }]
    const pool = await db.connectDb();

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Columns array is required.' });
    }

    const tableName = `sheet_data_${sheet_id}`;
    const updatedCols = [];

    for (const col of columns) {
      if (!col.id) continue;

      const name = col.column_name?.trim();
      const type = (col.data_type || 'NVARCHAR(MAX)').toUpperCase();

      // ✅ Get old column name for ALTER TABLE rename
      const oldColResult = await pool
        .request()
        .input('id', sql.Int, col.id)
        .query(`SELECT column_name FROM columns WHERE id = @id AND deleted_at IS NULL`);

      if (oldColResult.recordset.length === 0) continue;

      const oldName = oldColResult.recordset[0].column_name;

      // ✅ Rename or change datatype if needed
      if (oldName !== name) {
        const renameQuery = `EXEC sp_rename '${tableName}.[${oldName}]', '${name}', 'COLUMN';`;
        await pool.request().query(renameQuery);
      }

      const alterTypeQuery = `ALTER TABLE ${tableName} ALTER COLUMN [${name}] ${type};`;
      await pool.request().query(alterTypeQuery);

      // ✅ Update metadata
      await pool
        .request()
        .input('id', sql.Int, col.id)
        .input('column_name', sql.NVarChar, name)
        .input('data_type', sql.NVarChar, type)
        .query(`
          UPDATE columns
          SET column_name = @column_name,
              data_type = @data_type
          WHERE id = @id
        `);

      updatedCols.push({ id: col.id, column_name: name, data_type: type });
    }

    res.json({
      success: true,
      message: 'Columns updated successfully.',
      updated_columns: updatedCols,
    });
  } catch (err) {
    console.error('❌ Error updating columns:', err);
    res.status(500).json({ error: 'Failed to update columns' });
  }
};
