const express = require("express");
const router = express.Router();

const notificationController = require("../controllers//notification.controller");
router.get("/get-notification", notificationController.getNotifications);
router.get("/notifications/:notificationId", notificationController.markAsRead);

module.exports = router;
