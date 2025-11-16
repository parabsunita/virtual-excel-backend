const db = require("../config/db");
const sql = require("mssql");

// ======================================================================
//  ADD ROW 
// ======================================================================
exports.addRow = async (req, res) => {
  try {
    const { sheet_id, user_id } = req.params;
    const payload = req.body;

    if (!payload || !payload.row_data)
      return res.status(400).json({ success: false, message: "Invalid payload" });

    const rowData = payload.row_data;

    if (Object.keys(rowData).length === 0)
      return res.status(400).json({ success: false, message: "No data provided" });

    // prevent empty row
    if (Object.values(rowData).every(v => !v))
      return res.status(400).json({ success: false, message: "Cannot save empty row" });

    const pool = await db.connectDb();
    const tableName = `sheet_data_${sheet_id}`;

    // check table exists
    const check = await pool.request().query(`
      SELECT CASE WHEN OBJECT_ID('${tableName}', 'U') IS NULL THEN 0 ELSE 1 END AS exist
    `);

    if (check.recordset[0].exist === 0)
      return res.status(400).json({ success: false, message: "Sheet table missing" });

    // build dynamic insert
    const cols = Object.keys(rowData).map(c => `[${c}]`);
    const vals = Object.values(rowData);

    // add created_by
    cols.push("[created_by]");
    vals.push(user_id);

    const colStr = cols.join(",");
    const paramStr = vals.map((_, i) => `@p${i}`).join(",");

    let request = pool.request();

    vals.forEach((v, i) => {
      request.input(`p${i}`, sql.NVarChar, v ?? "");
    });

    const result = await request.query(`
      INSERT INTO ${tableName} (${colStr})
      OUTPUT inserted.id AS row_id
      VALUES (${paramStr})
    `);

    res.json({
      success: true,
      message: "Row added successfully",
      row_id: result.recordset[0].row_id
    });

  } catch (err) {
    console.error("❌ Add row error:", err);
    res.status(500).json({ success: false, message: "Failed to add row" });
  }
};


// ======================================================================
// LIST ROWS
// ======================================================================
exports.listRows = async (req, res) => {
  try {
    const { sheet_id } = req.params;

    const pool = await db.connectDb();
    const tableName = `sheet_data_${sheet_id}`;

    const check = await pool.request().query(`
      SELECT CASE WHEN OBJECT_ID('${tableName}', 'U') IS NULL THEN 0 ELSE 1 END AS exist
    `);

    if (check.recordset[0].exist === 0)
      return res.status(404).json({ success: false, message: "Sheet table missing" });

    const result = await pool.request().query(`
      SELECT * FROM ${tableName} ORDER BY id DESC
    `);

    res.json({
      success: true,
      rows: result.recordset
    });

  } catch (err) {
    console.error("❌ List rows error:", err);
    res.status(500).json({ success: false, message: "Failed to list rows" });
  }
};


// ======================================================================
// UPDATE ROW
// ======================================================================
exports.updateRow = async (req, res) => {
  try {
    const { sheet_id, id, user_id } = req.params;
    const rowData = req.body;

    if (!rowData || Object.keys(rowData).length === 0)
      return res.status(400).json({ success: false, message: "Nothing to update" });

    const pool = await db.connectDb();
    const tableName = `sheet_data_${sheet_id}`;

    const check = await pool.request().query(`
      SELECT CASE WHEN OBJECT_ID('${tableName}', 'U') IS NULL THEN 0 ELSE 1 END AS exist
    `);

    if (check.recordset[0].exist === 0)
      return res.status(404).json({ success: false, message: "Sheet table missing" });

    const setStr = Object.keys(rowData)
      .map((col, i) => `[${col}] = @v${i}`)
      .join(",");

    let request = pool.request();

    Object.values(rowData).forEach((val, i) => {
      request.input(`v${i}`, sql.NVarChar, val ?? "");
    });

    request.input("id", sql.Int, id);
    request.input("updated_by", sql.Int, user_id);

    await request.query(`
      UPDATE ${tableName}
      SET ${setStr}, updated_by=@updated_by, updated_at=GETDATE()
      WHERE id=@id
    `);

    res.json({ success: true, message: "Row updated successfully" });

  } catch (err) {
    console.error("❌ Update row error:", err);
    res.status(500).json({ success: false, message: "Failed to update row" });
  }
};


// ======================================================================
// DELETE ROW
// ======================================================================
exports.deleteRow = async (req, res) => {
  try {
    const { sheet_id } = req.params;
    let { id } = req.params;        // can be single ID
    let { ids } = req.body;         // can be array of IDs from frontend

    const pool = await db.connectDb();
    const tableName = `sheet_data_${sheet_id}`;

    // Check table exists
    const check = await pool.request().query(`
      SELECT CASE WHEN OBJECT_ID('${tableName}', 'U') IS NULL THEN 0 ELSE 1 END AS exist
    `);

    if (check.recordset[0].exist === 0)
      return res.status(404).json({ success: false, message: "Sheet table missing" });

    // Convert both into array (support both ways)
    let deleteIds = [];

    if (ids && Array.isArray(ids)) {
      deleteIds = ids;
    } else if (id) {
      deleteIds = [id];
    }

    if (deleteIds.length === 0)
      return res.status(400).json({ success: false, message: "No row IDs provided" });

    // Convert to integer list
    deleteIds = deleteIds.map((x) => parseInt(x));

    // SQL: DELETE FROM table WHERE id IN (...)
    const idList = deleteIds.join(",");

    await pool.request().query(`
      DELETE FROM ${tableName} 
      WHERE id IN (${idList})
    `);

    res.json({
      success: true,
      message: `Deleted ${deleteIds.length} row(s) successfully`,
      deleted_ids: deleteIds
    });

  } catch (err) {
    console.error("❌ Delete row error:", err);
    res.status(500).json({ success: false, message: "Failed to delete row" });
  }
};

