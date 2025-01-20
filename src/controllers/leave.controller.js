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

		// Create a new leave request (no deduction yet)
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

		if (user) {
			req.io.emit("leaveRequestNotification", {
				userId: user._id,
				message: `${user.name}: requested leave for ${newLeaveRequest.hours} hours on ${newLeaveRequest.date}`,
				leaveRequest: newLeaveRequest,
			});
		}

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

		const leaveRequest = await Leave.findById(leaveId)
			.populate("user", "name")
			.exec();
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
		console.log("Leave type:", leaveType);
		const leavePointsRequired = daysOfLeave;

		console.log("Leave points required:", leavePointsRequired);
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

		req.io.emit("leaveRequestNotification", {
			message: `Leave approved ${user.name} (${user.email})`,
			leaveRequest: leaveRequest,
		});

		res.status(200).json({
			message: "Leave request approved",
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

		// Apply status filter if provided
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
