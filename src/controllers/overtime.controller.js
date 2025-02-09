const Overtime = require("../models/overtime.model");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const Notification = require("../models/notification.model");

// Employee Request Overtime Functionality
const requestOvertime = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;
    const { date, hours, reason } = req.body;

    if (hours < 0.5) {
      return res
        .status(400)
        .json({ message: "Overtime hours must be at least 0.5." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const newOvertimeRequest = new Overtime({
      user: userId,
      date,
      hours,
      reason,
      status: "pending",
    });

    const savedOvertimeRequest = await newOvertimeRequest.save();

    // Notify admins
    const admins = await User.find({ role: "admin" });

    // Create notifications for admins
    const adminNotifications = admins.map((admin) => ({
      user: admin._id, // Notification for each admin
      title: "New Overtime Request",
      message: `${user.name} has requested overtime for [ ${
        newOvertimeRequest.hours
      }hours ] from ${new Date(newOvertimeRequest.date).toLocaleDateString(
        "en-GB"
      )} for reason: ${newOvertimeRequest.reason} : [ ${
        newOvertimeRequest.status
      } ]`,

      meta: { overtimeRequestId: savedOvertimeRequest._id },
    }));

    // Insert notifications into the database
    await Notification.insertMany(adminNotifications);

    // Fetch the updated list of notifications for each admin
    const updatedNotifications = await Notification.find({
      user: { $in: admins.map((admin) => admin._id) },
    }).sort({ createdAt: -1 }); // Most recent notifications first

    // Emit real-time notification to all connected admins
    admins.forEach((admin) => {
      req.io.emit("adminNotification", {
        title: "New Overtime Request",
        message: `${user.name} has requested overtime for [ ${
          newOvertimeRequest.hours
        }hours ] from ${new Date(newOvertimeRequest.date).toLocaleDateString(
          "en-GB"
        )} for reason: ${newOvertimeRequest.reason} : [ ${
          newOvertimeRequest.status
        } ]`,

        user: admin._id, // Notification for each admin
        notifications: updatedNotifications, // Include all notifications in real-time payload
      });
    });

    // Emit a notification event

    if (user) {
      req.io.emit("overtimeRequestNotification", {
        userId: user._id,
        message: `${user.name}: requested overtime request for ${newOvertimeRequest.hours} hours on ${newOvertimeRequest.date}`,
        overtimeRequest: newOvertimeRequest,
      });
    }

    res.status(201).json({
      message: "Overtime request submitted successfully.",
      overtimeRequest: newOvertimeRequest,
    });
  } catch (error) {
    console.error("Error requesting overtime:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Admin Accept Overtime Functionality
const acceptOvertime = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUserId = decodedToken.id;

    const adminUser = await User.findById(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Only admins can approve overtime." });
    }

    const { overtimeId } = req.params;

    const overtimeRequest = await Overtime.findById(overtimeId);
    if (!overtimeRequest) {
      return res.status(404).json({ message: "Overtime request not found." });
    }

    if (overtimeRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Overtime request is not in pending status." });
    }
    const user = await User.findById(overtimeRequest.user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    overtimeRequest.status = "rejected";
    overtimeRequest.rejectedBy = adminUserId;
    overtimeRequest.rejectedAt = new Date();

    await overtimeRequest.save();

    // save notification to database
    const userNotification = new Notification({
      user: user._id,
      title: "Overtime Request Rejected",
      message: `Your overtime request for [ ${
        overtimeRequest.hours
      } hours ] on ${new Date(overtimeRequest.date).toLocaleDateString(
        "en-GB"
      )} has been rejected by ${adminUser.name}.`,
      type: "success",
      meta: { overtimeRequestId: overtimeRequest._id },
    });

    await userNotification.save();

    // Emit real-time notification to the user
    req.io.to(user._id.toString()).emit("userNotification", {
      message: `Your overtime request has been rejected by ${adminUser.name}.`,
      overtimeRequest,
    });

    // Notify all admins about the approval
    const admins = await User.find({ role: "admin" });

    const adminNotifications = admins.map((admin) => ({
      user: admin._id, // Notification for each admin
      title: "Overtime Request Rejected",
      message: `${user.name} overtime request for [ ${
        overtimeRequest.hours
      } hours ] on ${new Date(overtimeRequest.date).toLocaleDateString(
        "en-GB"
      )} has been rejected by ${adminUser.name}.`,
      type: "info",
      meta: { overtimeRequestId: overtimeRequest._id },
    }));

    await Notification.insertMany(adminNotifications);

    // Emit real-time notification to all admins
    admins.forEach((admin) => {
      req.io.emit("userNotification", {
        message: `Your overtime request for [ ${
          overtimeRequest.hours
        } hours ] on ${new Date(overtimeRequest.date).toLocaleDateString(
          "en-GB"
        )} has been rejected by ${adminUser.name}.`,
        overtimeRequest,
        user: admin._id,
      });
    });

    res.status(200).json({
      message: "Overtime request rejected successfully.",
      overtimeRequest,
    });
  } catch (error) {
    console.error("Error accepting overtime:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Admin Reject Overtime Functionality
const rejectOvertime = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUserId = decodedToken.id;

    const adminUser = await User.findById(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Only admins can reject overtime." });
    }

    const { overtimeId } = req.params;

    const overtimeRequest = await Overtime.findById(overtimeId);
    if (!overtimeRequest) {
      return res.status(404).json({ message: "Overtime request not found." });
    }

    if (overtimeRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Overtime request is not in pending status." });
    }

    overtimeRequest.status = "rejected";
    overtimeRequest.rejectedBy = adminUserId;
    overtimeRequest.rejectedAt = new Date();

    await overtimeRequest.save();

    const user = await User.findById(overtimeRequest.user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await overtimeRequest.save();

    // save notification to database
    const userNotification = new Notification({
      user: user._id,
      title: "Overtime Request Rejected",
      message: `Your overtime request for [ ${
        overtimeRequest.hours
      } hours ] on ${new Date(overtimeRequest.date).toLocaleDateString(
        "en-GB"
      )} has been rejected by ${adminUser.name}.`,
      type: "success",
      meta: { overtimeRequestId: overtimeRequest._id },
    });

    await userNotification.save();

    // Emit real-time notification to the user
    req.io.to(user._id.toString()).emit("userNotification", {
      message: `Your overtime request has been rejected by ${adminUser.name}.`,
      overtimeRequest,
    });

    // Notify all admins about the approval
    const admins = await User.find({ role: "admin" });

    const adminNotifications = admins.map((admin) => ({
      user: admin._id, // Notification for each admin
      title: "Overtime Request Rejected",
      message: `${user.name}'s overtime request for [ ${
        overtimeRequest.hours
      } hours ] on ${new Date(overtimeRequest.date).toLocaleDateString(
        "en-GB"
      )} has been rejected by ${adminUser.name}.`,
      type: "info",
      meta: { overtimeRequestId: overtimeRequest._id },
    }));

    await Notification.insertMany(adminNotifications);

    // Emit real-time notification to all admins
    admins.forEach((admin) => {
      req.io.emit("userNotification", {
        message: `Your overtime request for [ ${
          overtimeRequest.hours
        } hours ] on ${new Date(overtimeRequest.date).toLocaleDateString(
          "en-GB"
        )} has been rejected by ${adminUser.name}.`,
        overtimeRequest,
        user: admin._id,
      });
    });

    res.status(200).json({
      message: "Overtime request rejected successfully.",
      overtimeRequest,
    });
  } catch (error) {
    console.error("Error rejecting overtime:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getAllOvertimeRequests = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUserId = decodedToken.id;

    const adminUser = await User.findById(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Only admins can view overtime requests.",
      });
    }

    // Extract filters and pagination from query params
    const {
      status,
      startDate,
      endDate,
      user: queryUser,
      page = 1,
      limit = 10,
    } = req.query;
    const filter = {};

    // Apply `status` filter if provided
    if (status && ["pending", "rejected", "rejected"].includes(status)) {
      filter.status = status;
    }

    // Apply date range filter for overtime requests
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      filter.createdAt = dateFilter;
    }

    // Filter by specific user if provided
    if (queryUser) {
      filter.user = queryUser;
    }

    // Log the filter for debugging
    console.log("Filter Object:", filter);

    // Fetch and paginate overtime requests
    const overtimeRequests = await Overtime.find(filter)
      .populate("user", "name email department job")
      .sort({ createdAt: -1 }) // Most recent requests first
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Count total requests for pagination
    const totalRequests = await Overtime.countDocuments(filter);

    if (overtimeRequests.length === 0) {
      return res.status(404).json({ message: "No overtime requests found." });
    }

    res.status(200).json({
      message: "Overtime requests retrieved successfully.",
      data: overtimeRequests,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalRequests / limit),
        totalRequests,
      },
    });
  } catch (error) {
    console.error("Error retrieving overtime requests:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getOwnOvertimeRecords = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;

    // Fetch overtime requests for the user
    const overtimeRequests = await Overtime.find({ user: userId })
      .populate("user", "name email department job")
      .sort({ createdAt: -1 }); // Sort by most recent first

    if (overtimeRequests.length === 0) {
      return res.status(404).json({ message: "No overtime requests found." });
    }

    res.status(200).json({
      message: "Overtime requests retrieved successfully.",
      data: overtimeRequests,
    });
  } catch (error) {
    console.error("Error retrieving own overtime records:", error);
    res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

module.exports = {
  requestOvertime,
  acceptOvertime,
  rejectOvertime,
  getAllOvertimeRequests,
  getOwnOvertimeRecords,
};
