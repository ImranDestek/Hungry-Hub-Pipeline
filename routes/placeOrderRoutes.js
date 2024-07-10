const express = require("express");
const router = express.Router();

const {
  searchRestaurantName,
  fetchCustomerData,
  fetchRestaurantCategories,
  fetchAllMenuItemsOfRestaurant,
  addNewUser,
  addAddress,
  addOrder,
  placeOrder,
} = require("../controllers/placeOrderController");

router.get("/search", searchRestaurantName);
router.get("/mobile", fetchCustomerData);
router.get("/category", fetchRestaurantCategories);
router.get("/menu", fetchAllMenuItemsOfRestaurant);
// router.post("/add-user", addNewUser);
// router.post("/add-address", addAddress);
// router.post("/order", addOrder);
router.post("/confirm", placeOrder);

module.exports = router;
