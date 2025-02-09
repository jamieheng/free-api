const mongoose = require("mongoose");

// Define the Leave schema
const leaveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    leaveType: {
      type: String,
      enum: ["sick", "annual", "unpaid"], // Types of leaves
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: false,
    },
    duration: {
      type: String,
      enum: ["full", "morning", "afternoon"], // Types of leave duration
      required: true,
    },
    points: {
      type: Number,
      required: true,
      default: function () {
        // Map duration to points
        const durationPoints = {
          full: 1, // Full day = 1 point
          morning: 0.5, // Morning = 0.5 points
          afternoon: 0.5, // Afternoon = 0.5 points
        };
        return durationPoints[this.duration] || 0; // Default to 0 if duration is invalid
      },
    },
    reason: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now, // Auto-set to current date when the leave is requested
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the approving user, typically an admin or manager
    },
    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Create the Leave model from the schema
const Leave = mongoose.model("Leave", leaveSchema);

module.exports = Leave;
