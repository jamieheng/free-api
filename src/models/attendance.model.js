const mongoose = require("mongoose");

// Define the Attendance schema
const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    clockIn: {
      type: Date,
      default: null, // Timestamp for when the user clocks in
    },
    clockOut: {
      type: Date,
      default: null, // timestamp for when the user clocks out
    },
    location: {
      clockIn: {
        latitude: { type: Number, required: true }, // Latitude at clock-in
        longitude: { type: Number, required: true }, // Longitude at clock-in
      },
      clockOut: {
        latitude: { type: Number }, // Latitude at clock-out
        longitude: { type: Number }, // Longitude at clock-out
      },
    },
    status: {
      type: String,
      enum: ["present", "absent", "onLeave", "late"],
      default: "absent", // Default attendance status
    },
    geofence: {
      centerLatitude: { type: Number, default: 0 }, // Geofence center latitude
      centerLongitude: { type: Number, default: 0 }, // Geofence center longitude
      radius: { type: Number, required: true, default: 100 }, // Radius in meters
    },

    totalWorkHours: {
      type: Number, // Total hours worked (calculated on clock-out)
      default: 0,
    },
  },
  { timestamps: true }
);

// Pre-save hook to ensure valid geofence data
attendanceSchema.pre("save", function (next) {
  if (
    this.geofence.centerLatitude === 0 ||
    this.geofence.centerLongitude === 0
  ) {
    throw new Error("Geofence center latitude and longitude must be set.");
  }
  next();
});

// Method to check if a given location is within the geofence
attendanceSchema.methods.isWithinGeofence = function (latitude, longitude) {
  const toRadians = (degree) => (degree * Math.PI) / 180;

  const earthRadius = 6371e3; // Earth's radius in meters
  const lat1 = toRadians(this.geofence.centerLatitude);
  const lon1 = toRadians(this.geofence.centerLongitude);
  const lat2 = toRadians(latitude);
  const lon2 = toRadians(longitude);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = earthRadius * c;

  return distance <= this.geofence.radius; // Returns true if within geofence
};

// Method to calculate work duration
attendanceSchema.methods.calculateWorkDuration = function () {
  if (!this.clockIn || !this.clockOut) {
    return 0; // No duration if clock-in or clock-out is missing
  }
  const duration = Math.abs(this.clockOut - this.clockIn); // Difference in milliseconds
  return (duration / (1000 * 60 * 60)).toFixed(2); // Return hours worked (rounded to 2 decimals)
};

// Post-save hook to calculate and update total work hours
attendanceSchema.post("save", function (doc, next) {
  if (doc.clockIn && doc.clockOut) {
    doc.totalWorkHours = doc.calculateWorkDuration();
    doc.save().then(() => next());
  } else {
    next();
  }
});

// Create the Attendance model from the schema
const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;
