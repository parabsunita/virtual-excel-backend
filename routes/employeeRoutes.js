const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// CRUD for employees (admin only)
router.post('/:org_id', verifyToken, authorizeRoles('admin'), employeeController.createEmployee);
router.get('/:org_id', verifyToken, authorizeRoles('admin'), employeeController.listEmployees);
router.put('/:org_id/:employee_id', verifyToken, authorizeRoles('admin'), employeeController.updateEmployee);
router.delete('/:org_id/:employee_id', verifyToken, authorizeRoles('admin'), employeeController.deleteEmployee);
router.patch('/:org_id/:employee_id/status', verifyToken, authorizeRoles('admin'), employeeController.toggleEmployeeStatus);

module.exports = router;
