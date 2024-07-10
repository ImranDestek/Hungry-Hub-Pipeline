const express = require("express");
const router = express.Router();

const {
  getAllMenuItemsOfRestaurant,
  updateRestaurantMenuItems,
  searchMenuItems,
} = require("../controllers/menuController");

router.route("/rest").post(getAllMenuItemsOfRestaurant);
router.put("/rest/update", updateRestaurantMenuItems);
router.get("/search", searchMenuItems);

module.exports = router;
