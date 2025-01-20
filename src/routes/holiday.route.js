const express = require("express");
const router = express.Router();

const holidayController = require("../controllers/holiday.controller");

router.post("/add-holiday", holidayController.addHoliday);
router.get("/get-holidays", holidayController.getHolidays);

module.exports = router;
