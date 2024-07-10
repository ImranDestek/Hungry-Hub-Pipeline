const pool = require("../db/pool");
const asyncHandler = require("express-async-handler");

// @desc Search by restaurant title
// @route GET /api/search?q=${title}
const searchRestaurantName = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    res.status(400);
    throw new Error("Please provide the restaurant title.");
  }

  const query = `
      SELECT id, title, full_address, city, landmark, lats, longs, ukm, uprice, aprice
      FROM rest_details
      WHERE title LIKE ? AND status = 1 AND rstatus = 1;
    `;

  const [restaurant] = await pool.query(query, [`%${q}%`]);

  if (!restaurant || restaurant.length === 0) {
    res.status(404);
    throw new Error("Restaurant not found!");
  }

  res.status(200).json({ restaurant: restaurant, success: true });
});

// @route GET /api/mobile?q=${title}
const fetchCustomerData = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    res.status(400);
    throw new Error("Please provide the mobile number.");
  }

  const checkUserQuery = `
      SELECT id, name
      FROM tbl_user
      WHERE mobile = ?;
    `;

  const [existingUser] = await pool.query(checkUserQuery, [q]);

  if (!existingUser || existingUser.length === 0) {
    res.status(404);
    throw new Error("User not found!");
  }

  const uid = existingUser[0].id;

  const fetchAddressQuery = `
      SELECT id,address, lat_map, long_map, landmark
      FROM tbl_address
      WHERE uid = ?;
    `;

  const [userAddresses] = await pool.query(fetchAddressQuery, [uid]);

  // Merge user data with an array of addresses
  const userDataWithAddresses = {
    ...existingUser[0],
    addresses: userAddresses || [],
  };

  res.status(200).json({ userData: userDataWithAddresses, success: true });
});

// @route GET /api/place-order/category?q=${title}
const fetchRestaurantCategories = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    res.status(400);
    throw new Error("Please provide the restaurant ID.");
  }

  const query = `
      SELECT *
      FROM rest_cat
      WHERE rid = ?;
    `;

  const [category] = await pool.query(query, [q]);

  if (!category || category.length === 0) {
    res.status(404);
    throw new Error("Category not found!");
  }

  res.status(200).json({ category: category, success: true });
});

const fetchAllMenuItemsOfRestaurant = asyncHandler(async (req, res) => {
  const { rid, menuid } = req.query;

  if (!rid) {
    res.status(400);
    throw new Error("Please provide the restaurant ID.");
  }

  const page = parseInt(req.query.page, 10) || 1;
  const itemsPerPage = 25;
  const offset = (page - 1) * itemsPerPage;

  let countQuery, menuQuery, queryParams;

  if (menuid) {
    countQuery = `
      SELECT COUNT(*) as totalItems
      FROM menu_item
      WHERE rid = ? AND menuid = ? AND status = 1
    `;

    menuQuery = `
      SELECT *
      FROM menu_item
      WHERE rid = ? AND menuid = ? AND status = 1
      ORDER BY id DESC
      LIMIT ${itemsPerPage}
      OFFSET ${offset}
    `;

    queryParams = [rid, menuid];
  } else {
    countQuery = `
      SELECT COUNT(*) as totalItems
      FROM menu_item
      WHERE rid = ? AND status = 1
    `;

    menuQuery = `
      SELECT *
      FROM menu_item
      WHERE rid = ? AND status = 1
      ORDER BY id DESC
      LIMIT ${itemsPerPage}
      OFFSET ${offset}
    `;

    queryParams = [rid];
  }

  const [countResult] = await pool.query(countQuery, queryParams);
  const totalItems = countResult[0].totalItems;

  const [menu] = await pool.query(menuQuery, queryParams);

  if (!menu || menu.length === 0) {
    res.status(404);
    throw new Error("Menu not found.");
  }

  res.status(200).json({ menu: menu, totalItems: totalItems, success: true });
});

const addNewUser = asyncHandler(async (req, res) => {
  const data = req.body;
  const userName = data.userName;
  const userMobile = data.userMobile;

  if (!userName) {
    res
      .status(400)
      .json({ message: "Please provide the user name.", success: false });
    throw new Error("Please provide the user name.");
  }
  if (!userMobile) {
    res
      .status(400)
      .json({ message: "Please provide the user mobile.", success: false });
    throw new Error("Please provide the user mobile.");
  }

  const insertQuery = `
      INSERT INTO tbl_user (name, mobile, device_id, fcm_id)
      VALUES (?, ?, '', '');
    `;

  const [userResult] = await pool.query(insertQuery, [userName, userMobile]);

  if (!userResult || userResult.affectedRows === 0) {
    res
      .status(400)
      .json({ message: "Error while creating user.", success: false });
    throw new Error("Error while creating user.");
  }

  const userId = userResult.insertId;

  req.body.userId = userId;

  addAddress(req, res);
});

const addAddress = asyncHandler(async (req, res) => {
  const data = req.body;

  const uid = data.userId;
  const address = data.userAddress;
  const landmark = data.userLandmark;
  const lat_map = data.userLatmap;
  const long_map = data.userLongmap;
  const houseno = data.houseno;
  const type = data.addressType;

  if (!uid) {
    res
      .status(400)
      .json({ message: "Please provide the user id.", success: false });
    throw new Error("Please provide the user id.");
  }
  if (!address) {
    res
      .status(400)
      .json({ message: "Please provide the user address.", success: false });
    throw new Error("Please provide the user address.");
  }
  // if (!landmark) {
  //   res
  //     .status(400)
  //     .json({ message: "Please provide the user landmark.", success: false });
  //   throw new Error("Please provide the user landmark.");
  // }
  if (!lat_map) {
    res.status(400).json({
      message: "Please provide the user latitude address.",
      success: false,
    });
    throw new Error("Please provide the user latitude address.");
  }
  if (!long_map) {
    res.status(400).json({
      message: "Please provide the user longitude address.",
      success: false,
    });
    throw new Error("Please provide the user longitude address.");
  }
  if (!type) {
    res.status(400).json({
      message: "Please provide the user longitude address.",
      success: false,
    });
    throw new Error("Please provide the user longitude address.");
  }

  const query = `
  INSERT INTO tbl_address (uid, address, houseno, landmark, type, lat_map, long_map, is_primary, pincode, city, state, country)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, '', '', '', '');`;

  const [userAddress] = await pool.query(query, [
    uid,
    address,
    houseno,
    landmark,
    type,
    lat_map,
    long_map,
  ]);

  if (!userAddress) {
    res.status(400);
    throw new Error("Error while creating userAddress.");
  }

  console.log(userAddress);

  const addressId = userAddress.insertId;
  req.body.addressId = addressId;

  addOrder(req, res);
});

const addOrder = asyncHandler(async (req, res) => {
  const data = req.body;

  const uid = data.userId;
  const rest_id = data.rest_id;
  const address = data.userAddress;
  const d_charge = data.deliveryCharge;
  const o_total = data.orderTotal;
  const subtotal = data.subtotal;
  const lats = data.userLatmap;
  const longs = data.userLongmap;
  const d_distance = data.d_distance;
  const addressId = data.addressId;

  if (!uid) {
    res
      .status(400)
      .json({ message: "Please provide the user id.", success: false });
    throw new Error("Please provide the user id.");
  }
  if (!rest_id) {
    res
      .status(400)
      .json({ message: "Please provide the rest_id.", success: false });
    throw new Error("Please provide the rest_id.");
  }
  if (!address) {
    res
      .status(400)
      .json({ message: "Please provide the user address.", success: false });
    throw new Error("Please provide the user address.");
  }
  if (!d_charge) {
    res
      .status(400)
      .json({ message: "Please provide the d_charge", success: false });
    throw new Error("Please provide the d_charge");
  }
  if (!o_total) {
    res
      .status(400)
      .json({ message: "Please provide the o_total.", success: false });
    throw new Error("Please provide the o_total");
  }
  if (!subtotal) {
    res
      .status(400)
      .json({ message: "Please provide the subtotal.", success: false });
    throw new Error("Please provide the subtotal");
  }
  if (!lats) {
    res
      .status(400)
      .json({ message: "Please provide the user latitude.", success: false });
    throw new Error("Please provide the user latitude.");
  }
  if (!longs) {
    res.status(400).json({
      message: "Please provide the user longitude.",
      success: false,
    });
    throw new Error("Please provide the user longitude.");
  }
  // if (!d_distance) {
  //   res.status(400).json({
  //     message: "Please provide the delivery distance.",
  //     success: false,
  //   });
  //   throw new Error("Please provide the delivery distance.");
  // }

  const query = `
  INSERT INTO temp_tbl_order (uid, rest_id, p_method_id, address,address_id, d_charge, o_total, subtotal, lats, longs, cou_id, cou_amt, trans_id, o_status, vcommission, dcommission, wall_amt, tip, rest_charge, atype, rest_store, d_partner, dp_type, self_pickup, d_distance, ondc_oid)
  VALUES (?, ?, 0, ?,?, ?, ?, ?, ?, ?, 0, 0, 0, 'Pending', 0, 0, 0, 0, 0, 'Home', 0, 0, 0, 0, ?, '');`;

  const [order] = await pool.query(query, [
    uid,
    rest_id,
    address,
    addressId,
    d_charge,
    o_total,
    subtotal,
    lats,
    longs,
    d_distance,
  ]);

  if (!order) {
    res.status(400);
    throw new Error("Error while creating order.");
  }

  const orderId = order.insertId;
  req.body.orderId = orderId;
  req.body.userId = uid;

  addProduct(req, res);
});

const addProduct = asyncHandler(async (req, res) => {
  const productArr = req.body.productArr;
  const orderId = req.body.orderId;

  if (!productArr || productArr.length === 0) {
    res.status(400).json({
      message: "Please provide a valid productArr",
      success: false,
    });
    throw new Error("Please provide a valid productArr");
  }

  // Construct the query string with placeholders for each product
  const query = `
    INSERT INTO temp_tbl_order_product (oid, pid, pquantity, ptitle, pprice, gst, is_veg)
    VALUES ${productArr.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")};
  `;

  // Flatten the array of values for the query parameters
  const queryParams = productArr.flatMap(
    ({ id, quantity, title, price, gst, is_veg }) => [
      orderId,
      id,
      quantity,
      title,
      price,
      gst,
      is_veg,
    ]
  );

  // Execute the query with parameters
  const [insertedProducts] = await pool.query(query, queryParams);

  if (!insertedProducts) {
    res
      .status(400)
      .json({ message: "Error while adding products.", success: false });
    throw new Error("Error while adding products.");
  }

  res.json({
    data: req.body,
    message: "Order Placed Successfully",
    success: true,
  });
});

const placeOrder = asyncHandler(async (req, res) => {
  let data = req.body;

  const userMobile = data?.userMobile;

  // SELECT COUNT(*) AS userCount, id AS userId
  const checkUserMobileQuery = `
  SELECT COUNT(*) AS userCount, MAX(id) AS userId
    FROM tbl_user
    WHERE mobile = ?;
  `;

  const [userCountResult] = await pool.query(checkUserMobileQuery, [
    userMobile,
  ]);

  const userCount = userCountResult[0].userCount;

  if (userCount > 0) {
    console.log("user found");
    const userId = userCountResult[0].userId;
    req.body.userId = userId;
    data.userId = userId;

    // addOrder(req, res);
    deleteUserOrder(req, res);
  } else {
    console.log("user not found");
    addNewUser(req, res);
  }

  // res.json({ data: data, message: "Order Placed Successfully", success: true });
});

const deleteUserOrder = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  // res.json({ userId });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const checkQuery = `
    SELECT id FROM temp_tbl_order WHERE uid = ?;
      `;

    const [result] = await pool.query(checkQuery, [userId]);

    // console.log("result", result[0]);

    if (result && result.length > 0) {
      // const count = result[0].count;
      const orderId = result[0].id;

      console.log(orderId);
      // res.json({ orderId });

      // if (count === 0) {
      //   return addOrder(req, res);
      // }

      const deleteQuery = `
            DELETE FROM temp_tbl_order
            WHERE uid = ?;
        `;

      const [deleteResult] = await pool.query(deleteQuery, [userId]);

      console.log("deleted order", deleteResult);

      // res.json({ message: "Deleted Order" });
      // return;

      const deleteProductQuery = `
      DELETE FROM temp_tbl_order_product
      WHERE oid = ?;
  `;

      await pool.query(deleteProductQuery, [orderId]);

      console.log("deleted product");

      await connection.commit();
    }
    addOrder(req, res);
  } catch (error) {
    await connection.rollback();

    console.error("Error deleting orders:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting orders.",
    });
  } finally {
    connection.release();
  }
});

module.exports = {
  searchRestaurantName,
  fetchCustomerData,
  fetchRestaurantCategories,
  fetchAllMenuItemsOfRestaurant,
  addNewUser,
  addAddress,
  addOrder,
  placeOrder,
};
