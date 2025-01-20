const Overtime = require("../models/overtime.model");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");

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

		await newOvertimeRequest.save();

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

		overtimeRequest.status = "approved";
		overtimeRequest.approvedBy = adminUserId;
		overtimeRequest.approvedAt = new Date();

		await overtimeRequest.save();

		// Notify the user about the approval
		const user = await User.findById(overtimeRequest.user);
		if (user) {
			req.io.emit("overtimeResponseNotification", {
				userId: user._id, // Use a unique identifier to target the user
				message: `${user.name}: overtime request for ${overtimeRequest.hours} hours on ${overtimeRequest.date} has been approved.`,
				overtimeRequest,
			});
		}

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
		overtimeRequest.approvedBy = adminUserId;
		overtimeRequest.approvedAt = new Date();

		await overtimeRequest.save();

		// Notify the user about the rejection
		const user = await User.findById(overtimeRequest.user);
		if (user) {
			req.io.emit("overtimeResponseNotification", {
				userId: user._id, // Use a unique identifier to target the user
				message: `${user.name}: overtime request for ${overtimeRequest.hours} hours on ${overtimeRequest.date} has been rejected.`,
				overtimeRequest,
			});
		}

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

		// Apply status filter if provided
		if (status && ["pending", "approved", "rejected"].includes(status)) {
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
