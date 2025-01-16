const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  try {
    // Extract the token from the Authorization header
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Access denied. No token provided." });
    }

    // Remove "Bearer " prefix to get the token
    const token = authHeader.replace("Bearer ", "");

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user information to the request object
    req.user = decoded;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired. Please log in again." });
    }

    res.status(400).json({ message: "Invalid token." });
  }
};

module.exports = authenticate;
