const mongoose = require("mongoose");

const positionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Position = mongoose.model("Position", positionSchema);

module.exports = Position;
