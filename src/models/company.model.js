const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: false, trim: true },
    industry: { type: String, required: false, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    establishedYear: { type: Number, required: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    geofence: {
      centerLatitude: { type: Number, required: true, default: 11.553861 },
      centerLongitude: { type: Number, required: true, default: 104.920528 },
      radius: { type: Number, required: true, default: 100 }, // Default radius in meters
    },
    workingHours: {
      start: { type: String, default: "09:00" }, // Default working start time
      end: { type: String, default: "17:00" }, // Default leaving time
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
