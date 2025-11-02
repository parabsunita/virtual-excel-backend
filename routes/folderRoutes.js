const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/:org_id', verifyToken, authorizeRoles('admin'), folderController.createFolder);
router.get('/:org_id', verifyToken, folderController.listFolders);

module.exports = router;
