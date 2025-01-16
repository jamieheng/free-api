const Overtime = require("../models/overtime.model");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");

// Employee Request Overtime Functionality
const requestOvertime = async (req, res) => {
  try {
    // Verify token and extract user ID
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;
    const { date, hours, reason } = req.body;

    // Validate overtime hours (minimum 0.5 hours)
    if (hours < 0.5) {
      return res
        .status(400)
        .json({ message: "Overtime hours must be at least 0.5." });
    }

    // Create a new overtime request
    const newOvertimeRequest = new Overtime({
      user: userId,
      date,
      hours,
      reason,
      status: "pending", // Initially, the overtime request will be in "pending" status
    });

    await newOvertimeRequest.save();

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

    // Find the overtime request
    const overtimeRequest = await Overtime.findById(overtimeId);

    if (!overtimeRequest) {
      return res.status(404).json({ message: "Overtime request not found." });
    }

    if (overtimeRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Overtime request is not in pending status." });
    }

    // Update the overtime request status to approved
    overtimeRequest.status = "approved";
    overtimeRequest.approvedBy = adminUserId;
    overtimeRequest.approvedAt = new Date();

    await overtimeRequest.save();

    res.status(200).json({
      message: "Overtime request approved successfully.",
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

    // Find the overtime request
    const overtimeRequest = await Overtime.findById(overtimeId);

    if (!overtimeRequest) {
      return res.status(404).json({ message: "Overtime request not found." });
    }

    if (overtimeRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Overtime request is not in pending status." });
    }

    // Update the overtime request status to rejected
    overtimeRequest.status = "rejected";
    overtimeRequest.approvedBy = adminUserId;
    overtimeRequest.approvedAt = new Date();

    await overtimeRequest.save();

    res.status(200).json({
      message: "Overtime request rejected successfully.",
      overtimeRequest,
    });
  } catch (error) {
    console.error("Error rejecting overtime:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = { requestOvertime, acceptOvertime, rejectOvertime };
