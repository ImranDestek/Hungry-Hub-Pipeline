const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  login,
  getAllUsers,
  searchUsers,
  updateUserDetails,
  save_cust_data,
  verify_cust_data,
  verify_otp_data,
  get_cust_data,
  update_cust_data,
  get_cust_address,
  update_cust_address,
  add_cust_address,
  delete_cust_address,
} = require("../controllers/userController");

const userStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./images/user");
  },
  filename: function (req, file, cb) {
    const filenameWithoutSpaces = file.originalname.replace(/\s+/g, "");
    return cb(null, `${filenameWithoutSpaces}`);
  },
});

const uploadUser = multer({ storage: userStorage });

router.route("/login").post(login);
router.get("/all", getAllUsers);
router.get("/search", searchUsers);
router.put("/update", updateUserDetails);

router.route("/save_cust_data").post(save_cust_data); // register user for waayu customer app
router.route("/verify_cust_data").post(verify_cust_data); //login user for waayu customer app
router.route("/verify_otp_data").post(verify_otp_data); // verify otp for waayu customer app
router.post("/get_cust_data", get_cust_data);
router.post("/update_cust_data", uploadUser.single("image"), update_cust_data);
router.post("/add_cust_address", add_cust_address);
router.post("/get_cust_address", get_cust_address);
router.post("/update_cust_address", update_cust_address);
router.post("/delete_cust_address", delete_cust_address);

module.exports = router;
