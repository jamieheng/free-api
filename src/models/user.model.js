const mongoose = require("mongoose");

// Define the User schema with the updated fields
const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		password: {
			type: String,
			required: true,
		},
		profilePicture: {
			type: String,
			required: false,
		},
		phone: {
			type: String,
			required: false,
			unique: false,
		},
		dateofbirth: {
			type: Date,
			required: false,
		},
		job: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Job", // Reference to the Job model
			required: false,
		},
		role: {
			type: String,
			enum: ["user", "admin"],
			default: "admin",
		},
		company: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Company", // Reference to the Company model
			required: false,
		},
		department: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Department", // Reference to the Department model as a team
			required: false,
		},
		position: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Position", // Reference to the Position model
			required: false,
		},
		isEmailVerified: {
			type: Boolean,
			default: false,
		},
		leaveBalance: {
			sick: {
				type: Number,
				default: 7, // Default sick leave points
				min: 0, // Ensure the value can't go below zero
			},
			annual: {
				type: Number,
				default: 15, // Default annual leave points
				min: 0, // Ensure the value can't go below zero
			},
			unpaid: {
				type: Number,
				default: 0, // Default unpaid leave points
				min: 0, // Ensure the value can't go below zero
			},
		},
	},
	{ timestamps: true }
);

// Create the User model from the schema
const User = mongoose.model("User", userSchema);

module.exports = User;
