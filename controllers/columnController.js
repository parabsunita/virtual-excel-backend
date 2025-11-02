const db = require('../config/db');

exports.addColumn = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const { column_name, data_type } = req.body;
    const [r] = await db.query('INSERT INTO columns (sheet_id, column_name, data_type) VALUES (?, ?, ?)', [sheet_id, column_name, data_type || 'TEXT']);
    res.json({ success: true, column_id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add column' });
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
