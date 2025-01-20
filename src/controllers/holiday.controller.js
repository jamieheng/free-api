const jwt = require("jsonwebtoken");
const Holiday = require("../models/holiday.model"); // Import the Holiday model
const User = require("../models/user.model");

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

    // Decode token and find the user
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if the user is an admin
    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Only admins can add holidays." });
    }

    // Extract fields from the request body
    const { name, date, companyId } = req.body;

    // Validate required fields
    if (!name || !date) {
      return res
        .status(400)
        .json({ message: "Name, date, and companyId are required." });
    }

    // Check if the holiday already exists for the given date and company
    const existingHoliday = await Holiday.findOne({ date, companyId });
    if (existingHoliday) {
      return res.status(409).json({
        message: "A holiday already exists for this date and company.",
      });
    }

    // Create a new holiday
    const holiday = new Holiday({
      name,
      date,
      companyId: user.company,
      createdBy: userId, // Use the logged-in user's ID as the creator
    });

    // Save the holiday to the database
    const savedHoliday = await holiday.save();

    res.status(201).json({
      message: "Holiday added successfully.",
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
