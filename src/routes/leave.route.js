const express = require("express");
const router = express.Router();

const leaveController = require("../controllers/leave.controller");

router.post("/request-leave", leaveController.requestLeave);
router.post("/accept-leave/:leaveId", leaveController.acceptLeave);
router.post("/reject-leave/:leaveId", leaveController.rejectLeave);
router.get("/get-all-leave-requests", leaveController.getAllLeaveRequests);
router.get("/get-own-leave-records", leaveController.getOwnLeaveRecords);

module.exports = router;
