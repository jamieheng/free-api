const express = require("express");
const router = express.Router();

const attendanceController = require("../controllers/attendance.controller");

router.post("/clock-in", attendanceController.clockIn);
router.post("/clock-out", attendanceController.clockOut);
router.get("/records", attendanceController.getAllAttendanceRecords);
router.get("/own-records", attendanceController.getOwnAttendanceRecords);
router.get("/record/:id", attendanceController.getAttendanceRecordById);

module.exports = router;
