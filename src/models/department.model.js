const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    jobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
      },
    ],
  },
  { timestamps: true }
);

const Department = mongoose.model("Department", departmentSchema);

module.exports = Department;
