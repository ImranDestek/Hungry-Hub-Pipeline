const express = require("express");
const router = express.Router();

const {
  getAllOrders,
  createOrderComment,
  fetchAllOrders,
  getSingleOrder,
  searchOrder,
  searchLiveOrders,
  cancelReasonDropdown,
  cancelOrder,
} = require("../controllers/orderController");

router.route("/all").post(getAllOrders).get(fetchAllOrders);
// router.get("/search/:id", searchOrder);
router.get("/search", searchOrder);
router.get("/live-search", searchLiveOrders);
router.post("/comment", createOrderComment);
router.get("/cancel_reason_dropdown", cancelReasonDropdown);
router.post("/cancel_order", cancelOrder);
router.get("/:id", getSingleOrder);

module.exports = router;
