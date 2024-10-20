// auth.controller.js

const User = require("./auth.model");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");

// Twilio configuration (replace with your credentials)
const accountSid = "your_account_sid";
const authToken = "your_auth_token";
const client = twilio(accountSid, authToken);

// Utility to generate random OTP
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP
const sendOtp = async (req, res) => {
  const { phone } = req.body;
  const otp = generateOtp();
  const otpExpiresAt = new Date(Date.now() + 5 * 60000); // OTP expires in 5 minutes

  try {
    let user = await User.findOne({ phone });

    if (!user) {
      user = new User({ phone, otp, otpExpiresAt });
    } else {
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
    }

    await user.save();

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your OTP code is ${otp}`,
      from: "your_twilio_phone_number", // Replace with Twilio number
      to: phone,
    });

    res.status(200).send({ message: "OTP sent successfully" });
  } catch (error) {
    res.status(500).send({ error: "Error sending OTP" });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const user = await User.findOne({ phone });

    if (!user || !user.isOtpValid(otp)) {
      return res.status(400).send({ error: "Invalid OTP" });
    }

    user.isVerified = true;
    user.otp = undefined; // Clear OTP after verification
    user.otpExpiresAt = undefined;
    await user.save();

    const token = jwt.sign({ _id: user._id.toString() }, "secretKey", {
      expiresIn: "7d", // Token expires in 7 days
    });

    res.send({ message: "OTP verified", token });
  } catch (error) {
    res.status(500).send({ error: "Verification failed" });
  }
};

// Middleware to authenticate user using JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    const decoded = jwt.verify(token, "secretKey");
    const user = await User.findOne({ _id: decoded._id });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: "Please authenticate" });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  auth,
};
