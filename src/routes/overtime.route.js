const express = require("express");
const router = express.Router();

const overtimeController = require("../controllers/overtime.controller");

router.post("/request-overtime", overtimeController.requestOvertime);
router.post("/accept-overtime/:overtimeId", overtimeController.acceptOvertime);
router.post("/reject-overtime/:overtimeId", overtimeController.rejectOvertime);

module.exports = router;
