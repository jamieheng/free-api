const Otp = require("../models/otp.model");
const crypto = require("crypto");

// Function to generate and send OTP
const sendOtp = async (phone) => {
  // Generate a 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // Create OTP entry in the database with expiration (e.g., 5 minutes)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiration
  await Otp.create({ phone, otp, expiresAt });

  // Log OTP to the console instead of sending via Twilio
  console.log(`OTP for ${phone} is: ${otp}`);
};

module.exports = { sendOtp };
