const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/:excel_id', verifyToken, authorizeRoles('admin'), sheetController.createSheet);
router.post('/upload/:excel_id', verifyToken, authorizeRoles('admin'), sheetController.uploadSheetData);
router.get('/:excel_id', verifyToken, sheetController.listSheets);

module.exports = router;
