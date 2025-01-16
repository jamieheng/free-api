const bcrypt = require("bcryptjs"); // For password hashing
const jwt = require("jsonwebtoken");
const User = require("../models/user.model"); // Assuming the path is correct
const Job = require("../models/job.model");
const Company = require("../models/company.model");
const Department = require("../models/department.model");
const Position = require("../models/position.model");

const addUser = async (req, res) => {
  try {
    // Extract the token from the request headers
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    // Verify the token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUser = await User.findById(decodedToken.id);

    if (!adminUser || adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Only admins can add users." });
    }

    const {
      name,
      email,
      password,
      role = "user",
      job,
      department,
      jobTitle,
      position,
      positionTitle,
      phone,
      dateofbirth,
    } = req.body;

    // Check for existing user by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let savedJob, savedPosition;

    // Job processing
    if (job) {
      savedJob = await Job.findById(job);
      if (!savedJob) {
        return res.status(404).json({ message: "Job not found." });
      }
    } else if (jobTitle && department) {
      const savedDepartment = await Department.findById(department);
      if (!savedDepartment) {
        return res.status(404).json({ message: "Department not found." });
      }

      // Create a new job and associate it with the department
      savedJob = new Job({
        title: jobTitle,
        department: savedDepartment._id,
      });
      savedJob = await savedJob.save();

      // Add the job to the department's jobs array
      savedDepartment.jobs.push(savedJob._id);
      await savedDepartment.save();
    }

    // Position processing
    if (position) {
      savedPosition = await Position.findById(position);
      if (!savedPosition) {
        return res.status(404).json({ message: "Position not found." });
      }
    } else if (positionTitle && savedJob) {
      // Create a new position and associate it with the job
      savedPosition = new Position({
        title: positionTitle,
        job: savedJob._id,
      });
      savedPosition = await savedPosition.save();

      // Add the position to the job's positions array
      savedJob.positions.push(savedPosition._id);
      await savedJob.save();
    }

    // Create a new user and assign the admin's company
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      job: savedJob ? savedJob._id : undefined,
      company: adminUser.company, // Assign admin's company to the new user
      department,
      position: savedPosition ? savedPosition._id : undefined,
      phone,
      dateofbirth,
    });

    await newUser.save();

    res
      .status(201)
      .json({ message: "User added successfully.", user: newUser });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const updateUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUser = await User.findById(decodedToken.id);

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const { userId } = req.params;
    const { name, email, role, job, department, position, phone, dateofbirth } =
      req.body;

    const userToUpdate = await User.findById(userId);

    if (!userToUpdate) {
      return res.status(404).json({ message: "User not found." });
    }

    if (userToUpdate.company.toString() !== adminUser.company.toString()) {
      return res
        .status(403)
        .json({ message: "You can only update users from your company." });
    }

    // Update user fields
    if (name) userToUpdate.name = name;
    if (email) userToUpdate.email = email;
    if (role) userToUpdate.role = role;
    if (phone) userToUpdate.phone = phone;
    if (dateofbirth) userToUpdate.dateofbirth = dateofbirth;

    // Validate and update job, department, and position
    if (job) {
      const savedJob = await Job.findById(job);
      if (
        !savedJob ||
        savedJob.company.toString() !== adminUser.company.toString()
      ) {
        return res.status(400).json({ message: "Invalid job ID provided." });
      }
      userToUpdate.job = job;
    }

    if (department) {
      const savedDepartment = await Department.findById(department);
      if (
        !savedDepartment ||
        savedDepartment.company.toString() !== adminUser.company.toString()
      ) {
        return res
          .status(400)
          .json({ message: "Invalid department ID provided." });
      }
      userToUpdate.department = department;
    }

    if (position) {
      const savedPosition = await Position.findById(position);
      if (
        !savedPosition ||
        savedPosition.company.toString() !== adminUser.company.toString()
      ) {
        return res
          .status(400)
          .json({ message: "Invalid position ID provided." });
      }
      userToUpdate.position = position;
    }

    await userToUpdate.save();

    res
      .status(200)
      .json({ message: "User updated successfully.", user: userToUpdate });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const deleteUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUser = await User.findById(decodedToken.id);

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const { userId } = req.params;

    const userToDelete = await User.findById(userId);

    if (!userToDelete) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if company exists on both users
    if (!userToDelete.company || !adminUser.company) {
      return res
        .status(400)
        .json({ message: "Both users must have a valid company assigned." });
    }

    // Compare company IDs
    if (userToDelete.company.toString() !== adminUser.company.toString()) {
      console.log(
        userToDelete.company.toString(),
        adminUser.company.toString()
      );
      return res
        .status(403)
        .json({ message: "You can only delete users from your company." });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUser = await User.findById(decodedToken.id);

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    // Get query parameters for filtering
    const { department, job } = req.query;

    // Build the query object
    const query = { company: adminUser.company, role: "user" };
    if (department) query.department = department;
    if (job) query.job = job;

    // Fetch users based on the query
    const users = await User.find(query)
      .populate("job")
      .populate("department")
      .populate("position");

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  addUser,
  updateUser,
  deleteUser,
  getAllUsers,
};
