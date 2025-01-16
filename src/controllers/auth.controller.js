const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"); // For password hashing
const User = require("../models/user.model"); // Assuming the path is correct
const Job = require("../models/job.model");
const Company = require("../models/company.model");
const Department = require("../models/department.model");
const Position = require("../models/position.model");
const companyController = require("./company.controller");

// Add a new user
const register = async (req, res) => {
  try {
    const {
      userName,
      email,
      password,
      companyName,
      companyAddress,
      industry,
      contactNumber,
      website,
      establishedYear,
      workHours,
    } = req.body;

    // Validate input (simple example)
    if (!email || !password || !userName || !companyName) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Validate password strength (example check)
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include a mix of uppercase, lowercase, and numbers.",
      });
    }

    // Check if the email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Hash the user's password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    const newUser = new User({
      name: userName,
      email,
      password: hashedPassword,
      role: "admin", // Set the role as "admin" for the first user
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    // Geofence validation (check if valid latitude, longitude, and radius)
    const { centerLatitude, centerLongitude, radius } = companyAddress;
    if (
      typeof centerLatitude !== "number" ||
      typeof centerLongitude !== "number" ||
      typeof radius !== "number" ||
      centerLatitude < -90 ||
      centerLatitude > 90 ||
      centerLongitude < -180 ||
      centerLongitude > 180 ||
      radius <= 0
    ) {
      return res.status(400).json({ message: "Invalid geofence data." });
    }

    // Create the company and link it to the user
    const newCompany = new Company({
      name: companyName,
      geofence: companyAddress,
      industry,
      contactNumber,
      website,
      establishedYear,
      workingHours: workHours,
      owner: savedUser._id, // Link company to user
    });

    // Save the company to the database
    const savedCompany = await newCompany.save();

    // Update the user to reference the created company
    savedUser.company = savedCompany._id;
    await savedUser.save();

    res.status(201).json({
      message: "User and company created successfully",
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
      },
      company: {
        id: savedCompany._id,
        name: savedCompany.name,
        address: savedCompany.geofence,
        industry: savedCompany.industry,
        contactNumber: savedCompany.contactNumber,
        website: savedCompany.website,
        establishedYear: savedCompany.establishedYear,
        workingHours: savedCompany.workingHours,
      },
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Log in a user
const logIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h", // Token expiration time
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const logOut = function (req, res) {
  res.status(200).json({ message: "Logout successful" });
};

module.exports = { register, logIn, logOut };
