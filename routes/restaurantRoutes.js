const express = require("express");
const router = express.Router();

const {
  getBannerList,
  getPopularRestaurant,
  getCravingData,
  getRestaurantNearYou,
  searchRestaurants,
  getRestaurantItemsAndCat,
  getRestaurantListAgainstCategory,
  getRestaurantCoupons,
  applyCoupon,
  getFavRestaurants,
  addFavRestaurant,
  deleteFavRestaurant,
  calcualteDeliveryAndRestCharges,
  getCustomizeAddonAndVariation,
  // placeOrder,
  getOrderDetails,
  getRecentOrderList,
  orderTrackingDetails,
  placeOrderNew,
  getRestaurantItemsAndCatNew,
  getRestaurantItemsAndCatFlutter,
  downloadInvoice,
  updateOrderStatus,
  sendOrderNotification,
  orderAcceptNotification,
  onRouteNotification,
  orderDeliveredNotification,
  commonNotification,
  fetchPaymentList,
  updatePaymentStatus,
  getCCAvenuePayment,
  addQrOrders,
  addonCatToppings,
} = require("../controllers/restaurantController");

//router.route("/get_banner").post(getBannerList);
router.get("/get_banner", getBannerList); //Customer APP Home top section banner list
router.post("/get_popular_restaurant", getPopularRestaurant);
router.get("/get_craving", getCravingData);
router.post("/get_near", getRestaurantNearYou);
router.post("/search_near", searchRestaurants);
router.post("/get_rest_details", getRestaurantItemsAndCat);
router.post("/get_rest_details_data", getRestaurantItemsAndCatNew);
router.post("/get_rest_details_addon", getRestaurantItemsAndCatFlutter);
router.post("/get_rest_against_category", getRestaurantListAgainstCategory);
router.post("/get_rest_coupons", getRestaurantCoupons);
router.post("/apply_coupon", applyCoupon);
router.post("/get_fav_rest", getFavRestaurants);
router.post("/add_fav_rest", addFavRestaurant);
router.post("/remove_fav_rest", deleteFavRestaurant);
router.post("/delivery_charges", calcualteDeliveryAndRestCharges);
router.post("/get_addon_variation", getCustomizeAddonAndVariation);
// router.post("/place_order", placeOrder);
router.post("/place_order_data", placeOrderNew);
router.post("/order_list", getRecentOrderList);
router.post("/order_details", getOrderDetails);
router.post("/order_tracking", orderTrackingDetails);
router.get("/download_invoice", downloadInvoice);
router.post("/send_order_notification", sendOrderNotification);
router.post("/order_accept_notification", orderAcceptNotification);
router.post("/order_onroute_notification", onRouteNotification);
router.post("/order_delivered_notification", orderDeliveredNotification);
router.post("/common_notification", commonNotification);
router.post("/update_order_status", updateOrderStatus);
router.post("/get_payment_list", fetchPaymentList);
router.post("/update_payment_status", updatePaymentStatus);
router.get("/cc", getCCAvenuePayment);
router.post("/add_qr_order", addQrOrders);
router.post("/cat_toppings", addonCatToppings);

module.exports = router;
