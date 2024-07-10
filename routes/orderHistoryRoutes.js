const express = require("express");
const router = express.Router();

const {
  getUserOrderHistory,
} = require("../controllers/orderHistoryController");

router.get("/user", getUserOrderHistory);

module.exports = router;
