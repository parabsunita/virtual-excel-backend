const db = require('../config/db');

exports.createSheet = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const { sheet_name } = req.body;
    const [r] = await db.query('INSERT INTO sheets (excel_id, sheet_name, created_by) VALUES (?, ?, ?)', [excel_id, sheet_name, req.user.id]);
    res.json({ success: true, sheet_id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create sheet' });
  }
};

exports.uploadSheetData = async (req, res) => {
  try {
    const { excel_id } = req.params;
    const { sheet_name, rows } = req.body;
    const [sr] = await db.query('INSERT INTO sheets (excel_id, sheet_name, created_by) VALUES (?, ?, ?)', [excel_id, sheet_name, req.user.id]);
    if (Array.isArray(rows) && rows.length) {
      const cols = Object.keys(rows[0]);
      for (const c of cols) {
        await db.query('INSERT INTO columns (sheet_id, column_name, data_type) VALUES (?, ?, ?)', [sr.insertId, c, 'TEXT']);
      }
      for (const row of rows) {
        await db.query('INSERT INTO rows (sheet_id, row_data, created_by) VALUES (?, ?, ?)', [sr.insertId, JSON.stringify(row), req.user.id]);
      }
    }
    res.json({ success: true, sheet_id: sr.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
};
exports.listSheets = async (req, res) => {
  try {
    const { excel_id } = req.params;

    // Fetch all sheets under the given Excel file
    const [sheets] = await db.query(
      'SELECT id, sheet_name, created_by, created_at FROM sheets WHERE excel_id = ?',
      [excel_id]
    );

    // Optionally fetch columns for each sheet
    const sheetData = await Promise.all(
      sheets.map(async (sheet) => {
        const [columns] = await db.query(
          'SELECT id, column_name, data_type FROM columns WHERE sheet_id = ?',
          [sheet.id]
        );
        return {
          ...sheet,
          columns
        };
      })
    );

    res.json({ success: true, sheets: sheetData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list sheets' });
  }
};