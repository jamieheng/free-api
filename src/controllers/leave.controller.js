const jwt = require("jsonwebtoken");
const Leave = require("../models/leave.model");
const User = require("../models/user.model");

// Employee Request Leave Functionality
const requestLeave = async (req, res) => {
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

    const { leaveType, startDate, endDate, reason, duration } = req.body;

    // Validate the dates
    if (new Date(startDate) > new Date(endDate)) {
      return res
        .status(400)
        .json({ message: "Start date cannot be after end date." });
    }

    // Fetch user details and leave balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if user has enough leave balance for the requested leave
    const leavePointsRequired = duration === "full" ? 1 : 0.5; // Full day = 1 point, half day = 0.5 points

    if (user.leaveBalance[leaveType] < leavePointsRequired) {
      return res
        .status(400)
        .json({ message: `Insufficient ${leaveType} leave balance.` });
    }

    // Deduct points from the user's leave balance
    user.leaveBalance[leaveType] -= leavePointsRequired;
    await user.save();

    // Create a new leave request
    const newLeaveRequest = new Leave({
      user: userId,
      leaveType,
      startDate,
      endDate,
      reason,
      duration,
      status: "pending", // Initially, the leave request will be in "pending" status
    });

    await newLeaveRequest.save();

    res.status(201).json({
      message: "Leave request submitted successfully.",
      leaveRequest: newLeaveRequest,
    });
  } catch (error) {
    console.error("Error requesting leave:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Admin Accept Leave Functionality
const acceptLeave = async (req, res) => {
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
        .json({ message: "Access denied. Only admins can approve leave." });
    }

    const { leaveId } = req.params;

    // Find the leave request
    const leaveRequest = await Leave.findById(leaveId);

    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    if (leaveRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Leave request is not in pending status." });
    }

    // Check if the leaveType is "full"
    if (leaveRequest.leaveType === "full") {
      // Calculate the number of days for the leave request
      const startDate = new Date(leaveRequest.startDate);
      const endDate = new Date(leaveRequest.endDate);
      const daysOfLeave =
        Math.ceil((endDate - startDate) / (1000 * 3600 * 24)) + 1; // Calculate number of days

      // Points to be deducted based on leave type (1 point per day)
      const pointsRequired = daysOfLeave;

      // Find the user who requested the leave
      const user = await User.findById(leaveRequest.user);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Log user leave balance and requested leave type for debugging
      console.log("User Leave Balance:", user.leaveBalance);
      console.log("Requested Leave Type:", leaveRequest.leaveType);

      // Check if the user has enough leave balance for the requested leave
      const currentBalance = user.leaveBalance.sick || 0; // Adjusted for specific leave type, change `sick` as per the request
      console.log("User Leave Balance:", currentBalance);
      console.log("Points required:", pointsRequired);

      if (currentBalance < pointsRequired) {
        console.log(`Insufficient leave balance for ${leaveRequest.leaveType}`);
        return res.status(400).json({ message: "Insufficient leave balance." });
      }

      // Deduct the points from the user's leave balance, ensuring it's a valid number
      const newBalance = currentBalance - pointsRequired;

      console.log("New Leave Balance:", newBalance);
      if (isNaN(newBalance) || newBalance < 0) {
        return res
          .status(400)
          .json({ message: "Invalid leave balance calculation." });
      }

      // Deduct points from the leave balance (here you can update based on the leave type)
      user.leaveBalance.sick = newBalance; // Update the sick leave balance (modify if needed)

      await user.save();
    }

    // Update the leave request status to approved
    leaveRequest.status = "approved";
    leaveRequest.approvedBy = adminUserId;
    leaveRequest.approvedAt = new Date();

    // Save the updated leave request
    await leaveRequest.save();

    res.status(200).json({
      message: "Leave request approved and leave balance updated.",
      leaveRequest,
    });
  } catch (error) {
    console.error("Error accepting leave:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Admin Reject Leave Functionality
const rejectLeave = async (req, res) => {
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
        .json({ message: "Access denied. Only admins can reject leave." });
    }

    const { leaveId } = req.params;

    // Find the leave request
    const leaveRequest = await Leave.findById(leaveId);

    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    if (leaveRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Leave request is not in pending status." });
    }

    // Update the leave request status to rejected
    leaveRequest.status = "rejected";
    leaveRequest.approvedBy = adminUserId;
    leaveRequest.approvedAt = new Date();

    await leaveRequest.save();

    res.status(200).json({
      message: "Leave request rejected successfully.",
      leaveRequest,
    });
  } catch (error) {
    console.error("Error rejecting leave:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = { requestLeave, acceptLeave, rejectLeave };
