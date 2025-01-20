const mongoose = require("mongoose");
const HolidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  date: {
    type: Date,
    required: true,
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Holiday", HolidaySchema);
