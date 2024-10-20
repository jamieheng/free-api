// auth.model.js

const mongoose = require("mongoose");

// Define the User schema
const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      required: false, // OTP will only be stored temporarily
    },
    otpExpiresAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

// Method to check if OTP is valid (within the expiry time)
userSchema.methods.isOtpValid = function (otp) {
  const user = this;
  return user.otp === otp && new Date() < user.otpExpiresAt;
};

// Create the User model from the schema
const User = mongoose.model("User", userSchema);

module.exports = User;
