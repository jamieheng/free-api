const jwt = require("jsonwebtoken");
const Company = require("../models/company.model");
const Department = require("../models/department.model");
const Job = require("../models/job.model");
const Position = require("../models/position.model");
const User = require("../models/user.model");
const addDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    const adminId = req.user.id; // Assuming `req.user` contains the authenticated admin's ID

    // Find the company owned by the admin
    const company = await Company.findOne({ owner: adminId });
    if (!company) {
      return res
        .status(404)
        .json({ message: "Company not found or you are not the owner" });
    }

    // Create a new department associated with the company
    const department = new Department({
      name,
      description,
      company: company._id,
    });

    // Save the department
    const savedDepartment = await department.save();

    res.status(201).json({
      message: "Department added successfully",
      department: savedDepartment,
    });
  } catch (error) {
    console.error("Error adding department:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};
const addJob = async (req, res) => {
  try {
    const { title, description, departmentId } = req.body;
    const adminId = req.user.id; // Assuming `req.user` contains the authenticated admin's ID

    // Validate the department and check if it belongs to a company owned by the admin
    const department = await Department.findById(departmentId).populate(
      "company"
    );
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    if (department.company.owner.toString() !== adminId) {
      return res.status(403).json({
        message: "You are not authorized to add a job to this department",
      });
    }

    // Create the job
    const job = new Job({
      title,
      description,
      department: department._id,
    });

    // Save the job
    const savedJob = await job.save();

    // Add the job to the department's jobs array
    department.jobs.push(savedJob._id);
    await department.save();

    res.status(201).json({
      message: "Job added successfully",
      job: savedJob,
    });
  } catch (error) {
    console.error("Error adding job:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

const addNewPosition = async (req, res) => {
  try {
    const { title, description, salary, jobId } = req.body;
    const adminId = req.user.id; // Assuming `req.user` contains the authenticated admin's ID

    // Find the job and populate its department and company details
    const job = await Job.findById(jobId).populate({
      path: "department",
      populate: {
        path: "company",
        select: "owner", // Only populate the owner field to minimize data
      },
    });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Validate if the authenticated admin is the owner of the company
    const companyOwnerId = job.department.company.owner.toString();
    if (companyOwnerId !== adminId) {
      return res.status(403).json({
        message: "You are not authorized to add a position to this job",
      });
    }

    // Create the position
    const position = new Position({
      title,
      description,
      job: job._id,
      salary,
    });

    // Save the position
    const savedPosition = await position.save();

    // Add the position to the job's positions array
    job.positions.push(savedPosition._id);
    await job.save();

    res.status(201).json({
      message: "Position added successfully",
      position: savedPosition,
    });
  } catch (error) {
    console.error("Error adding position:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

// ignore
const setWorkingHours = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUser = await User.findById(decodedToken.id);

    // Verify admin privileges
    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const { start, end } = req.body;

    // Validate input times
    if (!start || !end) {
      return res
        .status(400)
        .json({ message: "Start and end times are required." });
    }

    // Update working hours in the company document
    const updatedCompany = await Company.findByIdAndUpdate(
      adminUser.company,
      { workingHours: { start, end } },
      { new: true }
    );

    res.status(200).json({
      message: "Working hours updated successfully.",
      workingHours: updatedCompany.workingHours,
    });
  } catch (error) {
    console.error("Error setting working hours:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
// ignore
const getWorkingHours = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminUser = await User.findById(decodedToken.id);

    // Verify admin privileges
    if (!adminUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const company = await Company.findById(adminUser.company);

    if (!company) {
      return res.status(404).json({ message: "Company not found." });
    }

    res.status(200).json({
      message: "Working hours fetched successfully.",
      workingHours: company.workingHours,
    });
  } catch (error) {
    console.error("Error fetching working hours:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const updateCompany = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({ message: "Access denied. No token provided." });
    }

    // Verify and decode the token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decodedToken.id;

    // Verify admin privileges
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      return res.status(404).json({ message: "User not found." });
    }

    if (adminUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    // Find the company owned by the admin
    const company = await Company.findOne({ owner: adminId });
    if (!company) {
      return res
        .status(404)
        .json({ message: "Company not found or you are not the owner." });
    }

    // Update the company fields with the provided data
    const updates = req.body;
    Object.keys(updates).forEach((key) => {
      if (company[key] !== undefined) {
        company[key] = updates[key];
      }
    });

    // Save the updated company
    const updatedCompany = await company.save();

    res.status(200).json({
      message: "Company updated successfully.",
      company: updatedCompany,
    });
  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = { updateCompany };

module.exports = {
  addDepartment,
  addJob,
  addNewPosition,
  setWorkingHours,
  getWorkingHours,
  updateCompany,
};
