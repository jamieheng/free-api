const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: false, trim: true },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    positions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Position",
      },
    ],
  },
  { timestamps: true }
);

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
