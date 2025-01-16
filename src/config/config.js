module.exports = {
  port: process.env.PORT, // Provide default if process.env.PORT is undefined
  mongodb_uri: process.env.MONGODB_URI,
  jwt: process.env.JWT_SECRET,
  // Add other configuration options here
};
