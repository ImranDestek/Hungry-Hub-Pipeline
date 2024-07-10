const express = require("express");
const router = express.Router();

const {
  getRestaurantDetails,
  searchData,
  exportData,
  exportPayementSuccessData,
  addOrderHistory,
} = require("../controllers/ayodhyaRestaurantController");

router.get("/", getRestaurantDetails);
router.get("/search", searchData);
router.get("/export", exportData);
router.get("/export-success", exportPayementSuccessData);
router.post("/order-history", addOrderHistory);

module.exports = router;
