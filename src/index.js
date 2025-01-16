const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables from .env
dotenv.config();

const config = require("./config/config.js"); // Load after dotenv.config()

const app = express();

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

// Start the server
app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

// Connect to MongoDB
mongoose
  .connect(config.mongodb_uri) // Removed deprecated options
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
