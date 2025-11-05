const db = require('../config/db');

exports.addColumn = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const { columns } = req.body; // Expecting array: [{ column_name, data_type }]
    const org_id = req.query.org_id || req.user.org_id || req.user.id;

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'Columns array is required.' });
    }

    const pool = await db.connectDb();

    // ✅ Step 1: Validate that sheet exists and is not deleted
    const sheetCheck = await pool
      .request()
      .input('sheet_id', sql.Int, sheet_id)
      .query(`
        SELECT s.id, e.id AS excel_id
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

    // ✅ Step 2: Check existing columns for duplicates
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

      // ✅ Step 3: Add column to table
      const alterQuery = `
        ALTER TABLE ${tableName}
        ADD [${name}] ${type};
      `;
      await pool.request().query(alterQuery);

      // ✅ Step 4: Insert metadata
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


exports.listColumns = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const [rows] = await db.query('SELECT * FROM columns WHERE sheet_id = ?', [sheet_id]);
    res.json({ success: true, columns: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list columns' });
  }
};
