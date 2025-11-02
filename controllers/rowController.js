const db = require('../config/db');

exports.addRow = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const { row_data } = req.body;
    const [r] = await db.query('INSERT INTO rows (sheet_id, row_data, created_by) VALUES (?, ?, ?)', [sheet_id, JSON.stringify(row_data), req.user.id]);
    res.json({ success: true, row_id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add row' });
  }
};

exports.listRows = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    const [rows] = await db.query('SELECT * FROM rows WHERE sheet_id = ? ORDER BY id DESC', [sheet_id]);
    res.json({ success: true, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list rows' });
  }
};

exports.updateRow = async (req, res) => {
  try {
    const { id } = req.params;
    const { row_data } = req.body;
    await db.query('UPDATE rows SET row_data = ? WHERE id = ?', [JSON.stringify(row_data), id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update row' });
  }
};

exports.deleteRow = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM rows WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete row' });
  }
};
