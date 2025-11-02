const express = require('express');
const router = express.Router();
const columnController = require('../controllers/columnController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/:sheet_id', verifyToken, authorizeRoles('admin'), columnController.addColumn);
router.get('/:sheet_id', verifyToken, columnController.listColumns);

module.exports = router;
