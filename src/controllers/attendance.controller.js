const jwt = require("jsonwebtoken");
const Attendance = require("../models/attendance.model");
const User = require("../models/user.model");
const Company = require("../models/company.model");

const clockIn = async (req, res) => {
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

    const { latitude, longitude } = req.body;

    // Check for an existing active clock-in (i.e., no clock-out)
    const activeAttendance = await Attendance.findOne({
      user: userId,
      clockOut: null,
    });

    if (activeAttendance) {
      return res.status(400).json({
        message: "You cannot clock in again without clocking out first.",
      });
    }

    // Fetch user and their company to get working hours and geofence
    const user = await User.findById(userId).populate("company");
    if (!user || !user.company) {
      return res.status(404).json({ message: "User or company not found." });
    }

    const company = user.company;
    const workingStart = company.workingHours?.start;
    const geofence = company.geofence; // Geofence data from the company

    // Check if geofence is available
    if (
      !geofence ||
      !geofence.centerLatitude ||
      !geofence.centerLongitude ||
      !geofence.radius
    ) {
      return res.status(400).json({ message: "Geofence is not properly set." });
    }

    // Check if the user is within the geofence
    const distance = getDistance(
      latitude,
      longitude,
      geofence.centerLatitude,
      geofence.centerLongitude
    );

    if (distance > geofence.radius) {
      return res
        .status(400)
        .json({ message: "You are not within the geofence area." });
    }

    // Determine if the user is late
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const isLate = currentTime > workingStart;

    console.log(currentTime);
    console.log(workingStart);
    console.log("isLate", isLate);

    // Create a new attendance record
    const newAttendance = new Attendance({
      user: userId,
      clockIn: now,
      location: { clockIn: { latitude, longitude } },
      geofence,
      status: isLate ? "late" : "present",
    });

    await newAttendance.save();

    res.status(201).json({
      message: "Clocked in successfully.",
      attendance: newAttendance,
    });
  } catch (error) {
    console.error("Error during clock-in:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Clock-Out Functionality
const clockOut = async (req, res) => {
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

    const { latitude, longitude } = req.body;

    // Find the user's pending clock-in record
    const attendance = await Attendance.findOne({
      user: userId,
      clockOut: null,
    });

    if (!attendance) {
      return res.status(400).json({
        message: "No active clock-in record found. Please clock in first.",
      });
    }

    // Extract the geofence from the active attendance record
    const { geofence } = attendance;

    // Check if the user is within the geofence
    const distance = getDistance(
      latitude,
      longitude,
      geofence.centerLatitude,
      geofence.centerLongitude
    );

    if (distance > geofence.radius) {
      return res.status(400).json({
        message: "You are not within the geofence area. Clock-out denied.",
      });
    }

    // Update the attendance record with clock-out information
    attendance.clockOut = new Date();
    attendance.location.clockOut = { latitude, longitude };

    await attendance.save();

    res.status(200).json({ message: "Clocked out successfully.", attendance });
  } catch (error) {
    console.error("Error during clock-out:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Utility function to calculate distance between two coordinates
const getDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371e3; // Earth's radius in meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

const getAllAttendanceRecords = async (req, res) => {
  try {
    // Verify token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    // Decode token and find the user
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Log user details for debugging
    console.log("Decoded User ID:", userId);
    console.log("User Role:", user.role);

    // Base filter: Admin sees all, others see their own records
    const filter = user.role === "admin" ? {} : { user: userId };

    // Extract query parameters
    const { status, startDate, endDate, user: queryUser } = req.query;

    // Add `status` filter if provided and valid
    if (status && ["present", "absent", "onLeave", "late"].includes(status)) {
      filter.status = status;
    }

    // Add `clockIn` date range filter if both `startDate` and `endDate` are provided
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      filter.clockIn = dateFilter;
    }

    // Admin-specific: Add `user` filter if provided
    if (user.role === "admin" && queryUser) {
      filter.user = queryUser;
    }

    // Log the final filter for debugging
    console.log("Filter Object:", filter);

    // Fetch attendance records with filtering
    const attendanceRecords = await Attendance.find(filter)
      .populate("user", "name email department job")
      .sort({ clockIn: -1 }); // Most recent records first

    // Log fetched records for debugging
    console.log("Fetched Records:", attendanceRecords);

    // Respond with fetched records or an empty message
    if (attendanceRecords.length === 0) {
      return res.status(404).json({ message: "No attendance records found." });
    }

    res.status(200).json({
      message: "Attendance records fetched successfully.",
      attendanceRecords,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getAllAttendanceRecords,
};
