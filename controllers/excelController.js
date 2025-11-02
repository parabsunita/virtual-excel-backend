const db = require('../config/db');
const XLSX = require('xlsx');

exports.createExcel = async (req, res) => {
  try {
    const { folder_id } = req.params;
    const { excel_name } = req.body;
    const [r] = await db.query('INSERT INTO excels (folder_id, excel_name, created_by) VALUES (?, ?, ?)', [folder_id, excel_name, req.user.id]);
    res.json({ success: true, excel_id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create excel' });
  }
};

exports.uploadExcel = async (req, res) => {
  try {
    const { folder_id } = req.params;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const [er] = await db.query('INSERT INTO excels (folder_id, excel_name, created_by) VALUES (?, ?, ?)', [folder_id, fileName, req.user.id]);
    const workbook = XLSX.readFile(filePath);

    for (const sheetName of workbook.SheetNames) {
      const [sr] = await db.query('INSERT INTO sheets (excel_id, sheet_name, created_by) VALUES (?, ?, ?)', [er.insertId, sheetName, req.user.id]);
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      if (data.length > 0) {
        const cols = Object.keys(data[0]);
        for (const c of cols) {
          await db.query('INSERT INTO columns (sheet_id, column_name, data_type) VALUES (?, ?, ?)', [sr.insertId, c, 'TEXT']);
        }
        for (const row of data) {
          await db.query('INSERT INTO rows (sheet_id, row_data, created_by) VALUES (?, ?, ?)', [sr.insertId, JSON.stringify(row), req.user.id]);
        }
      }
    }

    res.json({ success: true, message: 'Excel uploaded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

exports.listExcels = async (req, res) => {
  try {
    const { folder_id } = req.params;
    const [rows] = await db.query('SELECT * FROM excels WHERE folder_id = ?', [folder_id]);
    res.json({ success: true, excels: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list excels' });
  }
};
