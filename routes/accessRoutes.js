const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const accessController = require('../controllers/accessController');

router.post('/', verifyToken, authorizeRoles('admin'), accessController.grantAccess);
router.get('/', verifyToken, authorizeRoles('admin'), accessController.getAccessList);
router.delete('/:id', verifyToken, authorizeRoles('admin'), accessController.revokeAccess);

module.exports = router;
