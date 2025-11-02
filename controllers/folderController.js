
const { sql, connectDb } = require('../config/db');

// ===============================
// ✅ Create Folder
// ===============================
exports.createFolder = async (req, res) => {
  try {
    const { org_id } = req.params;
    const { folder_name } = req.body;
    const pool = await connectDb();

    if (!folder_name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // 🔹 Check if organization exists
    const orgCheck = await pool.request()
      .input('org_id', sql.Int, org_id)
      .query('SELECT id FROM organizations WHERE id = @org_id');
    if (orgCheck.recordset.length === 0)
      return res.status(404).json({ error: 'Organization not found' });

    // 🔹 Insert new folder
    const result = await pool.request()
      .input('org_id', sql.Int, org_id)
      .input('folder_name', sql.NVarChar, folder_name)
      .input('created_by', sql.Int, org_id) // Assuming created_by is org_id for simplicity
      .query(`
        INSERT INTO folders (org_id, folder_name, created_by, created_at, active_status)
        VALUES (@org_id, @folder_name, @created_by, GETDATE(), 1);
        SELECT SCOPE_IDENTITY() AS folder_id;
      `);

    res.json({
      success: true,
      folder_id: result.recordset[0].folder_id,
      message: 'Folder created successfully'
    });
  } catch (err) {
    console.error('❌ createFolder Error:', err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
};

// ===============================
// ✅ List Folders (Optional Filter)
// ===============================
exports.listFolders = async (req, res) => {
  try {
    const { org_id } = req.params;
    const { status } = req.query;
    const pool = await connectDb();

    let query = `
      SELECT * FROM folders 
      WHERE org_id = @org_id AND deleted_at IS NULL
    `;
    if (status === 'active') query += ' AND active_status = 1';
    if (status === 'inactive') query += ' AND active_status = 0';

    const result = await pool.request()
      .input('org_id', sql.Int, org_id)
      .query(query);

    res.json({ success: true, folders: result.recordset });
  } catch (err) {
    console.error('❌ listFolders Error:', err);
    res.status(500).json({ error: 'Failed to list folders' });
  }
};

// ===============================
// ✅ Get Folder by ID
// ===============================
exports.getFolderById = async (req, res) => {
  try {
    const { org_id, folder_id } = req.params;
    const pool = await connectDb();

    const result = await pool.request()
      .input('org_id', sql.Int, org_id)
      .input('folder_id', sql.Int, folder_id)
      .query(`
        SELECT * FROM folders 
        WHERE id = @folder_id AND org_id = @org_id AND deleted_at IS NULL
      `);

    if (result.recordset.length === 0)
      return res.status(404).json({ error: 'Folder not found' });

    res.json({ success: true, folder: result.recordset[0] });
  } catch (err) {
    console.error('❌ getFolderById Error:', err);
    res.status(500).json({ error: 'Failed to fetch folder' });
  }
};

// ===============================
// ✅ Update Folder
// ===============================
exports.updateFolder = async (req, res) => {
  try {
    const { org_id, folder_id } = req.params;
    const { folder_name, active_status } = req.body;
    const pool = await connectDb();

    // 🔹 Check folder exists
    const check = await pool.request()
      .input('org_id', sql.Int, org_id)
      .input('folder_id', sql.Int, folder_id)
      .query(`
        SELECT id FROM folders 
        WHERE id = @folder_id AND org_id = @org_id AND deleted_at IS NULL
      `);
    if (check.recordset.length === 0)
      return res.status(404).json({ error: 'Folder not found' });

    // 🔹 Build dynamic update
    const updateFields = [];
    if (folder_name) updateFields.push('folder_name = @folder_name');
    if (typeof active_status === 'boolean') updateFields.push('active_status = @active_status');
    updateFields.push('updated_at = GETDATE()');

    if (updateFields.length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    const query = `
      UPDATE folders
      SET ${updateFields.join(', ')}
      WHERE id = @folder_id AND org_id = @org_id
    `;

    const reqDb = pool.request()
      .input('org_id', sql.Int, org_id)
      .input('folder_id', sql.Int, folder_id);

    if (folder_name) reqDb.input('folder_name', sql.NVarChar, folder_name);
    if (typeof active_status === 'boolean')
      reqDb.input('active_status', sql.Bit, active_status ? 1 : 0);

    await reqDb.query(query);

    res.json({ success: true, message: 'Folder updated successfully' });
  } catch (err) {
    console.error('❌ updateFolder Error:', err);
    res.status(500).json({ error: 'Failed to update folder' });
  }
};

// ===============================
// ✅ Soft Delete Folder
// ===============================
exports.deleteFolder = async (req, res) => {
  try {
    const { org_id, folder_id } = req.params;
    const pool = await connectDb();

    const check = await pool.request()
      .input('org_id', sql.Int, org_id)
      .input('folder_id', sql.Int, folder_id)
      .query(`
        SELECT id FROM folders 
        WHERE id = @folder_id AND org_id = @org_id AND deleted_at IS NULL
      `);
    if (check.recordset.length === 0)
      return res.status(404).json({ error: 'Folder not found or already deleted' });

    await pool.request()
      .input('org_id', sql.Int, org_id)
      .input('folder_id', sql.Int, folder_id)
      .query(`
        UPDATE folders 
        SET deleted_at = GETDATE(), active_status = 0 
        WHERE id = @folder_id AND org_id = @org_id
      `);

    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (err) {
    console.error('❌ deleteFolder Error:', err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
};
