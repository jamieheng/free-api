const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    otp: {
      type: Number,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
    expires: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Export the Otp model
const Otp = mongoose.model("Otp", otpSchema);

module.exports = Otp;
