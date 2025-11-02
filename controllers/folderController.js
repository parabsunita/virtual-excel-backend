const db = require('../config/db');

exports.createFolder = async (req, res) => {
  try {
    const { org_id } = req.params;
    const { folder_name } = req.body;
    const [r] = await db.query('INSERT INTO folders (org_id, folder_name, created_by) VALUES (?, ?, ?)', [org_id, folder_name, req.user.id]);
    res.json({ success: true, folder_id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
};

exports.listFolders = async (req, res) => {
  try {
    const { org_id } = req.params;
    const [rows] = await db.query('SELECT * FROM folders WHERE org_id = ?', [org_id]);
    res.json({ success: true, folders: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list folders' });
  }
};
