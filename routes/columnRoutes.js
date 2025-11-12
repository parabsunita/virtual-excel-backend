const express = require('express');
const router = express.Router();
const columnController = require('../controllers/columnController');

router.post('/:sheet_id', columnController.addColumn);
router.get('/:sheet_id', columnController.listColumns);
router.put('/:sheet_id', columnController.updateColumns); // 👈 for editing columns

module.exports = router;
