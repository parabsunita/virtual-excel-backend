const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// ✅ Admin only
router.post('/:org_id', verifyToken, authorizeRoles('admin'), folderController.createFolder);
router.put('/:org_id/:folder_id', verifyToken, authorizeRoles('admin'), folderController.updateFolder);
router.delete('/:org_id/:folder_id', verifyToken, authorizeRoles('admin'), folderController.deleteFolder);

// ✅ Admin & Employee can view
router.get('/:org_id', verifyToken, authorizeRoles('admin', 'employee'), folderController.listFolders);
router.get('/:org_id/:folder_id', verifyToken, authorizeRoles('admin', 'employee'), folderController.getFolderById);

module.exports = router;
