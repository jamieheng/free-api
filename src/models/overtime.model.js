const mongoose = require("mongoose");

// Define the Overtime schema
const overtimeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    date: {
      type: Date,
      required: true, // The date of the overtime
    },
    hours: {
      type: Number,
      required: true, // The number of overtime hours
      min: 1, // Minimum an hour
    },
    reason: {
      type: String,
      trim: true, // Optional reason for the overtime request
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending", // Initial status of the overtime request
    },
    requestedAt: {
      type: Date,
      default: Date.now, // Auto-set to the current date when the request is made
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the approving user, typically an admin/manager
    },
    approvedAt: {
      type: Date, // Timestamp for when the overtime was approved
    },
  },
  { timestamps: true }
);

// Create the Overtime model from the schema
const Overtime = mongoose.model("Overtime", overtimeSchema);

module.exports = Overtime;
