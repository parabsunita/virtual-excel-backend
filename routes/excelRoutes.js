const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const excelController = require('../controllers/excelController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/:folder_id', verifyToken, authorizeRoles('admin'), excelController.createExcel);
router.post('/upload/:folder_id', verifyToken, authorizeRoles('admin'), upload.single('file'), excelController.uploadExcel);
router.get('/:folder_id', verifyToken, excelController.listExcels);

module.exports = router;
