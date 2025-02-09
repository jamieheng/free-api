const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");

router.post("/add-user", userController.addUser);
router.delete("/users/:userId", userController.deleteUser);
router.put("/users/:userId", userController.updateUser);
router.post("/get-users", userController.getAllUsers);
router.get("/get-user/:userId", userController.getUserById);

module.exports = router;
