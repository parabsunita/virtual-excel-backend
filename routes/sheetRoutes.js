const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Sheets under an Excel
router.post('/:excel_id', verifyToken, authorizeRoles('admin'), sheetController.createSheet);
router.post('/upload/:excel_id', verifyToken, authorizeRoles('admin'), sheetController.uploadSheetData);
router.get('/:excel_id', verifyToken, sheetController.listSheets);
router.put('/:sheet_id', verifyToken, authorizeRoles('admin'), sheetController.updateSheet);
router.delete('/:sheet_id', verifyToken, authorizeRoles('admin'), sheetController.deleteSheet);
router.get('/sheet/:sheet_id', verifyToken, sheetController.getSheetById);
module.exports = router;
