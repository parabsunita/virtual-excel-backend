const express = require('express');
const router = express.Router();
const rowController = require('../controllers/rowController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/:sheet_id', verifyToken, authorizeRoles('admin','employee'), rowController.addRow);
router.get('/:sheet_id', verifyToken, rowController.listRows);
router.put('/:id', verifyToken, authorizeRoles('admin','employee'), rowController.updateRow);
router.delete('/:id', verifyToken, authorizeRoles('admin'), rowController.deleteRow);

module.exports = router;
