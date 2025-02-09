const jwt = require("jsonwebtoken");
const Holiday = require("../models/holiday.model"); // Import the Holiday model
const User = require("../models/user.model");
const Notification = require("../models/notification.model");
const Company = require("../models/company.model");

// Add Holiday Controller
const addHoliday = async (req, res) => {
  try {
    // Verify token
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    // Decode token and find the admin user
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUserId = decodedToken.id;

    const adminUser = await User.findById(adminUserId);
    if (!adminUser) {
      return res.status(404).json({ message: "Admin user not found." });
    }

    console.log("Admin User: ", adminUser);

    // Find the company where the admin is the owner
    const company = await Company.findOne({ owner: adminUserId });
    if (!company) {
      return res
        .status(404)
        .json({ message: "No company found for this admin." });
    }

    // Extract fields from the request body
    const { name, date } = req.body;

    // Validate required fields
    if (!name || !date) {
      return res
        .status(400)
        .json({ message: "Name and date are required fields." });
    }

    // Check if the holiday already exists for the given date in the company
    const existingHoliday = await Holiday.findOne({
      date,
      companyId: company._id,
    });
    if (existingHoliday) {
      return res.status(409).json({
        message: "A holiday already exists for this date in your company.",
      });
    }

    // Create a new holiday
    const holiday = new Holiday({
      name,
      date,
      companyId: company._id,
      createdBy: adminUserId,
    });

    // Save the holiday to the database
    const savedHoliday = await holiday.save();

    // Notify all users in the company
    const users = await User.find({ company: company._id });

    const userNotifications = users.map((user) => ({
      user: user._id,
      title: "New Holiday Added",
      message: `A new holiday '${name}' has been added on ${new Date(
        date
      ).toLocaleDateString("en-GB")}.`,
      type: "info",
      meta: { holidayId: savedHoliday._id },
    }));

    await Notification.insertMany(userNotifications);

    const admins = await User.find({ role: "admin" });
    // Emit real-time notification to the user
    users.forEach((user) => {
      req.io.to(user._id.toString()).emit("userNotification", {
        message: `A new holiday '${name}' has been added on ${new Date(
          date
        ).toLocaleDateString("en-GB")}.`,
        holiday: savedHoliday,
      });
    });

    // Emit real-time notification to all users in the company
    users.forEach((user) => {
      req.io.to(user._id.toString()).emit("userNotification", {
        message: `A new holiday '${name}' has been added on ${new Date(
          date
        ).toLocaleDateString("en-GB")}.`,
        holiday: savedHoliday,
      });
    });

    // Emit real-time notification to all admins
    admins.forEach((admin) => {
      req.io.emit("userNotification", {
        message: `A new holiday '${name}' has been added on ${new Date(
          date
        ).toLocaleDateString("en-GB")}.`,
        holiday: savedHoliday,
        user: admin._id,
      });
    });

    res.status(201).json({
      message: "Holiday added successfully, and users notified.",
      data: savedHoliday,
    });
  } catch (error) {
    console.error("Error adding holiday:", error);
    res.status(500).json({
      message: "An error occurred while adding the holiday.",
      error: error.message,
    });
  }
};

const getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find();
    res.status(200).json({
      message: "Holidays retrieved successfully.",
      data: holidays,
    });
  } catch (error) {
    console.error("Error retrieving holidays:", error);
    res.status(500).json({
      message: "An error occurred while retrieving holidays.",
      error: error.message,
    });
  }
};

module.exports = { addHoliday, getHolidays };
