const Notification = require("../models/notification.model");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

// Create Notification
const createNotification = async (userId, title, message, meta = {}) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "No token provided" });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;
    const role = decodedToken.role; // Assuming 'role' is part of the token payload

    const notification = new Notification({
      user: userId,
      title,
      message,
      meta,
    });

    await notification.save();

    // Emit the notification to the user in real-time
    // Assuming socket.io is available via `req.io` from the request object
    req.io.emit("newNotification", {
      userId,
      message,
      title,
      meta,
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw new Error("Failed to create notification");
  }
};

// Fetch Notifications for a user
const getNotifications = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;

    if (!userId) {
      return res
        .status(400)
        .json({ message: "Invalid token. No user ID found." });
    }

    // Fetch the notifications for the user in reverse order (oldest first)
    const notifications = await Notification.find({ user: userId }).sort({
      createdAt: 1, // Oldest notifications first
    });

    if (notifications.length === 0) {
      return res.status(404).json({ message: "No notifications found." });
    }

    res.status(200).json({
      message: "Notifications fetched successfully.",
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// Mark Notification as Read
const markAsRead = async (notificationId) => {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    notification.read = true;
    await notification.save();

    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw new Error("Failed to mark notification as read");
  }
};

module.exports = { createNotification, getNotifications, markAsRead };
