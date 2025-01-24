const jwt = require("jsonwebtoken");
const Leave = require("../models/leave.model");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");

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

		// Create a new leave request
		const newLeaveRequest = new Leave({
			user: userId,
			leaveType,
			startDate,
			endDate,
			reason,
			duration,
			status: "pending",
		});

		const savedLeaveRequest = await newLeaveRequest.save();

		// Notify admins
		const admins = await User.find({ role: "admin" });

		// Create notifications for admins
		const adminNotifications = admins.map((admin) => ({
			user: admin._id, // Notification for each admin
			title: "New Leave Request",
			message: `${user.name} has requested leave [${
				newLeaveRequest.leaveType
			}, ${newLeaveRequest.duration}] from ${new Date(
				newLeaveRequest.startDate
			).toLocaleDateString("en-GB")} to ${new Date(
				newLeaveRequest.endDate
			).toLocaleDateString("en-GB")} for reason: ${newLeaveRequest.reason} : ${
				newLeaveRequest.status
			}`,

			meta: { leaveRequestId: savedLeaveRequest._id },
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
				title: "New Leave Request",
				message: `${user.name} has requested leave [${
					newLeaveRequest.leaveType
				}, ${newLeaveRequest.duration}] from ${new Date(
					newLeaveRequest.startDate
				).toLocaleDateString("en-GB")} to ${new Date(
					newLeaveRequest.endDate
				).toLocaleDateString("en-GB")} for reason: ${
					newLeaveRequest.reason
				} : ${newLeaveRequest.status}`,

				user: admin._id,
				notifications: updatedNotifications,
			});
		});

		res.status(201).json({
			message: "Leave request submitted successfully and admins notified.",
			leaveRequest: savedLeaveRequest,
		});
	} catch (error) {
		console.error("Error requesting leave:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

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

		const leaveRequest = await Leave.findById(leaveId);
		if (!leaveRequest) {
			return res.status(404).json({ message: "Leave request not found." });
		}

		if (leaveRequest.status !== "pending") {
			return res
				.status(400)
				.json({ message: "Leave request is not in pending status." });
		}

		const user = await User.findById(leaveRequest.user);
		if (!user) {
			return res.status(404).json({ message: "User not found." });
		}

		const startDate = new Date(leaveRequest.startDate);
		const endDate = leaveRequest.endDate
			? new Date(leaveRequest.endDate)
			: startDate;
		const leaveDuration = leaveRequest.duration === "full" ? 1 : 0.5;
		const daysOfLeave =
			Math.ceil((endDate - startDate) / (1000 * 3600 * 24)) + leaveDuration;

		const leaveType = leaveRequest.leaveType;
		const leavePointsRequired = daysOfLeave;

		// Ensure the leaveType exists in user's leaveBalance
		if (user.leaveBalance[leaveType] === undefined) {
			return res.status(400).json({
				message: `Leave type '${leaveType}' does not exist in user's leave balance.`,
			});
		}

		// Check if the user has enough leave balance
		if (user.leaveBalance[leaveType] < leavePointsRequired) {
			return res.status(400).json({
				message: "Insufficient leave balance to approve this request.",
			});
		}

		// Deduct leave points
		user.leaveBalance[leaveType] -= leavePointsRequired;

		await user.save();

		leaveRequest.status = "approved";
		leaveRequest.approvedBy = adminUserId;
		leaveRequest.approvedAt = new Date();

		await leaveRequest.save();

		// Notify the user
		const userNotification = new Notification({
			user: user._id,
			title: "Leave Request Approved",
			message: `Your leave request for ${leaveType} (${
				leaveRequest.duration
			}) from ${new Date(leaveRequest.startDate).toLocaleDateString(
				"en-GB"
			)} to ${new Date(leaveRequest.endDate).toLocaleDateString(
				"en-GB"
			)} has been approved by ${adminUser.name}.`,
			type: "success",
			meta: { leaveRequestId: leaveRequest._id },
		});

		await userNotification.save();

		// Emit real-time notification to the user
		req.io.to(user._id.toString()).emit("userNotification", {
			message: `Your leave request has been approved by ${adminUser.name}.`,
			leaveRequest,
		});

		// Notify all admins about the approval
		const admins = await User.find({ role: "admin" });

		const adminNotifications = admins.map((admin) => ({
			user: admin._id, // Notification for each admin
			title: "Leave Request Approved",
			message: `Your leave request for ${leaveType} (${
				leaveRequest.duration
			}) from ${new Date(leaveRequest.startDate).toLocaleDateString(
				"en-GB"
			)} to ${new Date(leaveRequest.endDate).toLocaleDateString(
				"en-GB"
			)} has been approved by ${adminUser.name}.`,
			type: "info",
			meta: { leaveRequestId: leaveRequest._id },
		}));

		await Notification.insertMany(adminNotifications);

		// Emit real-time notification to all admins
		admins.forEach((admin) => {
			req.io.emit("userNotification", {
				message: `Your leave request for ${leaveType} (${
					leaveRequest.duration
				}) from ${new Date(leaveRequest.startDate).toLocaleDateString(
					"en-GB"
				)} to ${new Date(leaveRequest.endDate).toLocaleDateString(
					"en-GB"
				)} has been approved by ${adminUser.name}.`,
				leaveRequest,
				user: admin._id,
			});
		});

		res.status(200).json({
			message:
				"Leave request approved, leave balance updated, user and admins notified.",
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

		const leaveRequest = await Leave.findById(leaveId);
		if (!leaveRequest) {
			return res.status(404).json({ message: "Leave request not found." });
		}

		if (leaveRequest.status !== "pending") {
			return res
				.status(400)
				.json({ message: "Leave request is not in pending status." });
		}

		const user = await User.findById(leaveRequest.user);
		if (!user) {
			return res.status(404).json({ message: "User not found." });
		}

		const leaveType = leaveRequest.leaveType;

		// Update the leave request status
		leaveRequest.status = "rejected";
		leaveRequest.approvedBy = adminUserId;
		leaveRequest.approvedAt = new Date();
		await leaveRequest.save();

		// Create a notification for the user
		const userNotification = new Notification({
			user: user._id,
			title: "Leave Request Rejected",
			message: `Your leave request for [ ${leaveType} ] from ${new Date(
				leaveRequest.startDate
			).toLocaleDateString("en-GB")} to ${new Date(
				leaveRequest.endDate
			).toLocaleDateString("en-GB")} has been rejected by ${adminUser.name}.`,
			type: "error",
			meta: { leaveRequestId: leaveRequest._id },
		});
		await userNotification.save();

		// Emit a real-time notification to the user
		req.io.to(user._id.toString()).emit("userNotification", {
			message: `Your leave request for ${leaveType} has been rejected by ${adminUser.name}.`,
			leaveRequest,
		});

		// Notify all admins about the rejection
		const admins = await User.find({ role: "admin" });
		const adminNotifications = admins.map((admin) => ({
			user: admin._id,
			title: "Leave Request Rejected",
			message: `${
				user.name
			}'s leave request for [ ${leaveType} ] from ${new Date(
				leaveRequest.startDate
			).toLocaleDateString("en-GB")} to ${new Date(
				leaveRequest.endDate
			).toLocaleDateString("en-GB")} has been rejected by ${adminUser.name}.`,
			type: "info",
			meta: { leaveRequestId: leaveRequest._id },
		}));

		await Notification.insertMany(adminNotifications);

		// Emit real-time notification to all admins
		admins.forEach((admin) => {
			req.io.emit("userNotification", {
				message: `${user.name}'s leave request for ${leaveType} has been rejected by ${adminUser.name}.`,
				leaveRequest,
				user: admin._id,
			});
		});

		// Send success response
		res.status(200).json({
			message: "Leave request rejected successfully. User and admins notified.",
			leaveRequest,
		});
	} catch (error) {
		console.error("Error rejecting leave:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

// Admin Get All Leave Requests
const getAllLeaveRequests = async (req, res) => {
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
				message: "Access denied. Only admins can view leave requests.",
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
		if (status && ["pending", "approved", "rejected"].includes(status)) {
			filter.status = status;
		}

		// Apply date range filter for leave requests
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

		// Fetch and paginate leave requests
		const leaveRequests = await Leave.find(filter)
			.populate("user", "name email department job")
			.sort({ createdAt: -1 }) // Most recent requests first
			.skip((page - 1) * limit)
			.limit(Number(limit));

		// Count total requests for pagination
		const totalRequests = await Leave.countDocuments(filter);

		if (leaveRequests.length === 0) {
			return res.status(404).json({ message: "No leave requests found." });
		}

		res.status(200).json({
			message: "Leave requests retrieved successfully.",
			data: leaveRequests,
			pagination: {
				currentPage: Number(page),
				totalPages: Math.ceil(totalRequests / limit),
				totalRequests,
			},
		});
	} catch (error) {
		console.error("Error retrieving leave requests:", error);
		res.status(500).json({ message: "Internal server error." });
	}
};

// get the own leave records
const getOwnLeaveRecords = async (req, res) => {
	try {
		const token = req.headers.authorization?.split(" ")[1];
		if (!token) {
			return res
				.status(403)
				.json({ message: "Access denied. No token provided." });
		}

		const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
		const userId = decodedToken.id;

		// Fetch leave requests for the user
		const leaveRequests = await Leave.find({ user: userId })
			.populate("user", "name email department job")
			.sort({ createdAt: -1 }); // Sort by most recent first

		if (leaveRequests.length === 0) {
			return res.status(404).json({ message: "No leave requests found." });
		}

		res.status(200).json({
			message: "Leave requests retrieved successfully.",
			data: leaveRequests,
		});
	} catch (error) {
		console.error("Error retrieving own leave records:", error);
		res.status(500).json({
			message: "Internal server error.",
			error: error.message,
		});
	}
};

module.exports = {
	requestLeave,
	acceptLeave,
	rejectLeave,
	getAllLeaveRequests,
	getOwnLeaveRecords,
};
