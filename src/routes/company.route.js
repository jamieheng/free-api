const express = require("express");
const router = express.Router();
const companyController = require("../controllers/company.controller");
const authenticate = require("../middlewares/authMiddleware");

router.post("/departments", authenticate, companyController.addDepartment);
router.post("/jobs", authenticate, companyController.addJob);
router.post("/positions", authenticate, companyController.addNewPosition);
router.post("/set-working-hours", companyController.setWorkingHours);
router.get("/working-hours", companyController.getWorkingHours);
router.put("/update-company", companyController.updateCompany);

module.exports = router;
