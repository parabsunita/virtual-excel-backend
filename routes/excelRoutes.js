const express = require('express');
const router = express.Router();
const excelController = require('../controllers/excelController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// ===============================
// ✅ Create Excel under a Folder (Admin only)
// POST /api/excels/:folder_id
// ===============================
router.post('/:folder_id', verifyToken, authorizeRoles('admin'), excelController.createExcel);

// ===============================
// ✅ Upload Excel Data (Admin only)
// POST /api/excels/upload/:excel_id
// ===============================
router.post('/upload/:excel_id', verifyToken, authorizeRoles('admin'), excelController.uploadExcelData);

// ===============================
// ✅ List Excels in a Folder (Admin + Employee)
// GET /api/excels/:folder_id
// ===============================
router.get('/:folder_id', verifyToken, excelController.listExcels);

// ===============================
// ✅ Update Excel Properties (Admin only)
// PUT /api/excels/:folder_id/:excel_id
// ===============================
router.put('/:folder_id/:excel_id', verifyToken, authorizeRoles('admin'), excelController.updateExcel);

// ===============================
// ✅ Delete Excel (Admin only - soft delete)
// DELETE /api/excels/:folder_id/:excel_id
// ===============================
router.delete('/:folder_id/:excel_id', verifyToken, authorizeRoles('admin'), excelController.deleteExcel);

module.exports = router;
