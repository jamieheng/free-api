const express = require("express");
const router = express.Router();

const overtimeController = require("../controllers/overtime.controller");

router.post("/request-overtime", overtimeController.requestOvertime);
router.post("/accept-overtime/:overtimeId", overtimeController.acceptOvertime);
router.post("/reject-overtime/:overtimeId", overtimeController.rejectOvertime);
router.get(
	"/get-all-overtime-requests",
	overtimeController.getAllOvertimeRequests
);
router.get(
	"/get-own-overtime-records",
	overtimeController.getOwnOvertimeRecords
);

module.exports = router;
