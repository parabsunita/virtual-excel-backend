const db = require('../config/db');

exports.grantAccess = async (req, res) => {
  try {
    const { employee_id, folder_id, sheet_id, column_id, can_read, can_write } = req.body;
    const granted_by = req.user.id;
    const [existing] = await db.query('SELECT * FROM access_controls WHERE employee_id=? AND folder_id=? AND sheet_id=? AND column_id=?', [employee_id, folder_id || None, sheet_id || None, column_id || None]);
    if (existing.length) {
      await db.query('UPDATE access_controls SET can_read=?, can_write=?, granted_by=? WHERE id=?', [can_read, can_write, granted_by, existing[0].id]);
      return res.json({ success: true, message: 'Access updated' });
    }
    await db.query('INSERT INTO access_controls (employee_id, folder_id, sheet_id, column_id, can_read, can_write, granted_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [employee_id, folder_id || None, sheet_id || None, column_id || None, can_read||False, can_write||False, granted_by]);
    res.status(201).json({ success: true, message: 'Access granted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Grant access failed' });
  }
};

exports.getAccessList = async (req, res) => {
  try {
    const orgId = req.user.id;
    const [rows] = await db.query(`SELECT ac.*, e.name as employee_name, f.folder_name, s.sheet_name, c.column_name FROM access_controls ac LEFT JOIN employees e ON ac.employee_id=e.id LEFT JOIN folders f ON ac.folder_id=f.id LEFT JOIN sheets s ON ac.sheet_id=s.id LEFT JOIN columns c ON ac.column_id=c.id WHERE e.org_id = ?`, [orgId]);
    res.json({ success: true, access: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fetch access failed' });
  }
};

exports.revokeAccess = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM access_controls WHERE id = ?', [id]);
    res.json({ success: true, message: 'Access revoked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Revoke failed' });
  }
};
