const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const User = require("./models/user.model");

// Load environment variables from .env
dotenv.config();

const config = require("./config/config.js"); // Load after dotenv.config()

const app = express();
const server = http.createServer(app); // Create an HTTP server
const io = new Server(server, {
	cors: {
		origin: "*", // Allow all origins for development (update for production)
		methods: ["GET", "POST"],
	},
});
// Attach io to req in middleware
app.use((req, res, next) => {
	req.io = io;
	next();
});
// Middleware
app.use(cors());
app.use(express.json()); // To parse incoming JSON request bodies

// Authentication routes
const authRoutes = require("./routes/auth.route"); // Ensure file exists and is correct
app.use("/api/auth", authRoutes); // "/api/auth" reflects authentication route purpose

// Company routes
const companyRoutes = require("./routes/company.route");
app.use("/api/companies", companyRoutes);

// User routes
const userRoutes = require("./routes/user.route");
app.use("/api/users", userRoutes);

// Attendance routes
const attendanceRoutes = require("./routes/attendance.route");
app.use("/api/attendances", attendanceRoutes);

// Leave routes
const leaveRoutes = require("./routes/leave.route");
app.use("/api/leaves", leaveRoutes);

// Overtime routes
const overtimeRoutes = require("./routes/overtime.route");
app.use("/api/overtimes", overtimeRoutes);

// Holiday routes
const holidayRoutes = require("./routes/holiday.route");
app.use("/api/holidays", holidayRoutes);

// Notification routes
const notificationRoutes = require("./routes/notification.route");
app.use("/api/notifications", notificationRoutes);

// Socket.IO Middleware for Authentication
io.use(async (socket, next) => {
	const token = socket.handshake.auth.token;

	if (!token) {
		return next(new Error("Authentication token is missing"));
	}

	try {
		// Verify and decode the token
		const decoded = jwt.verify(token, config.jwt); // Use your JWT secret

		// Fetch the user details from the database
		const user = await User.findById(decoded.id); // Assuming decoded.id is the user ID
		if (!user) {
			return next(new Error("User not found"));
		}

		// Attach the full user object to the socket
		socket.user = {
			id: user._id,
			name: user.name,
			role: user.role,
			email: user.email,
		};

		console.log(`Authenticated user: ${user.name} (${user.role})`);
		next();
	} catch (err) {
		console.error("Authentication error:", err.message);
		next(new Error("Authentication error"));
	}
});

// Socket.IO Event Handling
io.on("connection", (socket) => {
	console.log(`User connected: ${socket.user.id} (${socket.user.role})`);

	// Send a welcome message based on role
	const welcomeMessage =
		socket.user.role === "admin"
			? "Welcome, Admin! You will receive all notifications."
			: "Welcome, User! You will receive relevant notifications.";
	socket.emit("receiveNotification", {
		title: "Welcome",
		message: welcomeMessage,
	});

	// Broadcast to all admins
	const broadcastToAdmins = (event, data) => {
		io.sockets.sockets.forEach((clientSocket) => {
			if (clientSocket.user && clientSocket.user.role === "admin") {
				clientSocket.emit(event, data);
			}
		});
	};

	// Broadcast to all users
	const broadcastToUsers = (event, data) => {
		io.sockets.sockets.forEach((clientSocket) => {
			if (clientSocket.user && clientSocket.user.role === "user") {
				clientSocket.emit(event, data);
			}
		});
	};

	// Handle admin-specific notifications
	socket.on("adminNotification", (data) => {
		if (socket.user.role === "admin") {
			broadcastToAdmins("receiveAdminNotification", data);
		} else {
			socket.emit("receiveNotification", {
				title: "Error",
				message: "Unauthorized access",
			});
		}
	});

	// Handle user-specific notifications
	socket.on("userNotification", (data) => {
		if (socket.user.role === "user") {
			broadcastToUsers("receiveUserNotification", data);
		} else {
			socket.emit("receiveNotification", {
				title: "Error",
				message: "Unauthorized access",
			});
		}
	});

	// General notification (sent to everyone)
	socket.on("generalNotification", (data) => {
		io.emit("receiveNotification", data);
	});

	socket.on("disconnect", () => {
		console.log(`User disconnected: ${socket.user.id}`);
	});
});

// Start the server
server.listen(config.port, () => {
	console.log(`Server is running on port ${config.port}`);
});

// Connect to MongoDB
mongoose
	.connect(config.mongodb_uri, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	}) // Add connection options
	.then(() => {
		console.log("Connected to MongoDB successfully!");
		console.log("Configuration:");
		console.log(`- Port: ${config.port}`);
		console.log(`- MongoDB URI: ${config.mongodb_uri}`);
		console.log(`- JWT Secret: ${config.jwt}`);
	})
	.catch((error) => {
		console.error("Error connecting to MongoDB:", error.message);
	});
