const express = require("express");
const cors = require("cors");
const config = require("./config/config");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Define your routes here
const exampleRoutes = require("./routes/auth.route");
app.use("/api/example", exampleRoutes);

// Start the server
app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
