const pool = require("../db/pool");
const asyncHandler = require("express-async-handler");

// @desc Get Restaurant Details
// @route GET /api/ayodhya-rest
const getRestaurantDetails = asyncHandler(async (req, res) => {
  const page = parseInt(req?.query?.page) || 1;
  let limit = 10;
  let offset = (page - 1) * limit;
  // const restaurantId = 680; // staging
  const restaurantId = 830; // live

  const status = req?.query?.status;
  const paymentStatus = req?.query?.paymentStatus;

  let order_status_num = null;
  let ordersQuery;
  let ordersParams;

  if (status === "pending") {
    order_status_num = 0;
  } else if (status === "delivered") {
    order_status_num = 7;
  } else if (status === "accept") {
    order_status_num = 1;
  } else if (status === "on_route") {
    order_status_num = 6;
  }

  if (status === "all") {
    console.log("ALL");
    ordersQuery = `
      SELECT
        o.id,
        o.odate,
        o.o_total,
        o.dp_type,
        o.o_status as orderstatus,
        o.payment_status,
        u.name AS username,
        u.mobile AS usermobile,
        r.title AS restaurant_title,
        dp.dp_name AS delivery_partner_name,
        th.tracking_id,
        th.tracking_url
      FROM
        tbl_order o
        LEFT JOIN tbl_user u ON o.uid = u.id
        LEFT JOIN rest_details r ON o.rest_id = r.id
        LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
        LEFT JOIN tbl_order_history th ON o.id = th.orderid AND th.orderstatus = 6
      WHERE
        rest_id = ?
      ORDER BY
        o.odate DESC
      LIMIT ? OFFSET ?;
    `;
    ordersParams = [restaurantId, limit, offset];
  } else if (order_status_num !== null) {
    console.log("status", order_status_num);
    ordersQuery = `
      SELECT
        o.id,
        o.odate,
        o.o_total,
        o.dp_type,
        o.o_status as orderstatus,
        o.payment_status,
        u.name AS username,
        u.mobile AS usermobile,
        r.title AS restaurant_title,
        dp.dp_name AS delivery_partner_name,
        th.tracking_id,
        th.tracking_url
      FROM
        tbl_order o
        LEFT JOIN tbl_user u ON o.uid = u.id
        LEFT JOIN rest_details r ON o.rest_id = r.id
        LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
        LEFT JOIN tbl_order_history th ON o.id = th.orderid AND th.orderstatus = 6
      WHERE payment_status <> 'Aborted' AND o.order_status = ? AND rest_id = ?
      ORDER BY
        o.odate DESC
      LIMIT ? OFFSET ?;
    `;
    console.log(order_status_num, restaurantId, limit, offset);
    ordersParams = [order_status_num, restaurantId, limit, offset];
  } else if (paymentStatus === "Aborted") {
    console.log("Aborted Status");
    ordersQuery = `
      SELECT
        o.id,
        o.odate,
        o.o_total,
        o.dp_type,
        o.o_status as orderstatus,
        o.payment_status,
        u.name AS username,
        u.mobile AS usermobile,
        r.title AS restaurant_title,
        dp.dp_name AS delivery_partner_name,
        th.tracking_id,
        th.tracking_url
      FROM
        tbl_order o
        LEFT JOIN tbl_user u ON o.uid = u.id
        LEFT JOIN rest_details r ON o.rest_id = r.id
        LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
        LEFT JOIN tbl_order_history th ON o.id = th.orderid AND th.orderstatus = 6
      WHERE (payment_status = 'Aborted' OR payment_status = 'Failure' OR payment_status = 'Pending') AND rest_id = ?
      ORDER BY
        o.odate DESC
      LIMIT ? OFFSET ?;
    `;
    ordersParams = [restaurantId, limit, offset];
  } else if (paymentStatus === "Success") {
    console.log("Success Status");
    ordersQuery = `
      SELECT
        o.id,
        o.odate,
        o.o_total,
        o.dp_type,
        o.o_status as orderstatus,
        o.payment_status,
        u.name AS username,
        u.mobile AS usermobile,
        r.title AS restaurant_title,
        dp.dp_name AS delivery_partner_name,
        th.tracking_id,
        th.tracking_url
      FROM
        tbl_order o
        LEFT JOIN tbl_user u ON o.uid = u.id
        LEFT JOIN rest_details r ON o.rest_id = r.id
        LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
        LEFT JOIN tbl_order_history th ON o.id = th.orderid AND th.orderstatus = 6
      WHERE rest_id = ? AND payment_status = 'Success' AND o_total = 100 AND cc_orderid IS NOT NULL
      ORDER BY
        o.odate DESC
      LIMIT ? OFFSET ?;
    `;
    ordersParams = [restaurantId, limit, offset];
  } else if (paymentStatus === "All") {
    console.log("Payment Status", paymentStatus);
    ordersQuery = `
      SELECT
        o.id,
        o.odate,
        o.o_total,
        o.dp_type,
        o.o_status as orderstatus,
        o.payment_status,
        u.name AS username,
        u.mobile AS usermobile,
        r.title AS restaurant_title,
        dp.dp_name AS delivery_partner_name,
        th.tracking_id,
        th.tracking_url
      FROM
        tbl_order o
        LEFT JOIN tbl_user u ON o.uid = u.id
        LEFT JOIN rest_details r ON o.rest_id = r.id
        LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
        LEFT JOIN tbl_order_history th ON o.id = th.orderid AND th.orderstatus = 6
      WHERE rest_id = ?
      ORDER BY
        o.odate DESC
      LIMIT ? OFFSET ?;
    `;
    ordersParams = [restaurantId, limit, offset];
  }

  const [ordersResult] = await pool.query(ordersQuery, ordersParams);

  if (!ordersResult || ordersResult.length === 0) {
    res.status(404);
    throw new Error("No orders found.");
  }

  let totalCountQuery;

  if (status === "all") {
    totalCountQuery = `SELECT COUNT(*) AS total FROM tbl_order WHERE rest_id = ?`;
  } else if (status === "pending") {
    totalCountQuery = `
      SELECT COUNT(*) AS total
      FROM tbl_order
      WHERE payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 0 AND rest_id = ?;
    `;
  } else if (status === "accept") {
    totalCountQuery = `
      SELECT COUNT(*) AS total
      FROM tbl_order
      WHERE payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 1 AND rest_id = ?;
    `;
  } else if (status === "on_route") {
    totalCountQuery = `
      SELECT COUNT(*) AS total
      FROM tbl_order
      WHERE payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 6 AND rest_id = ?;
      `;
  } else if (status === "delivered") {
    totalCountQuery = `
      SELECT COUNT(*) AS total
      FROM tbl_order
      WHERE payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 7 AND rest_id = ?;
      `;
  } else if (paymentStatus === "Success") {
    totalCountQuery = `SELECT COUNT(*) AS total
        FROM tbl_order
        WHERE rest_id = ? AND payment_status = 'Success' AND o_total = 100 AND cc_orderid IS NOT NULL`;
  } else if (paymentStatus === "Aborted") {
    totalCountQuery = `SELECT COUNT(*) AS total
        FROM tbl_order
        WHERE (payment_status = 'Aborted' OR payment_status = 'Failure' OR payment_status = 'Pending') AND rest_id = ?`;
  } else if (paymentStatus === "All") {
    totalCountQuery = `SELECT COUNT(*) AS total
        FROM tbl_order
        WHERE rest_id = ?`;
  }

  const [countResult] = await pool.query(totalCountQuery, [restaurantId]);

  const totalOrders = countResult[0].total;

  res.status(200).json({
    orders: ordersResult,
    totalCount: totalOrders,
    success: true,
  });
});

const searchData = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    res.status(400);
    throw new Error("Please provide the search query.");
  }

  const page = parseInt(req?.query?.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  const restaurantId = 830;

  const query = `
      SELECT 
      o.id,
      o.odate,
      o.o_total,
      o.dp_type,
      o.o_status as orderstatus,
      o.payment_status,
      u.name AS username,
      u.mobile AS usermobile,
      r.title AS restaurant_title,
      dp.dp_name AS delivery_partner_name,
      th.tracking_id,
      th.tracking_url
      FROM tbl_order o
      LEFT JOIN tbl_user u ON o.uid = u.id
      LEFT JOIN rest_details r ON o.rest_id = r.id
      LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
      LEFT JOIN tbl_order_history th ON o.id = th.orderid AND th.orderstatus = 6
      WHERE rest_id = ? AND (o.id LIKE ? OR u.name LIKE ? OR u.mobile LIKE ?)
      ORDER BY o.odate DESC
      LIMIT ? OFFSET ?
    `;

  const [order] = await pool.query(query, [
    restaurantId,
    `%${q}%`,
    `%${q}%`,
    `%${q}%`,
    limit,
    offset,
  ]);

  if (!order || order.length === 0) {
    res.status(404);
    throw new Error("Order not found!");
  }

  res
    .status(200)
    .json({ orders: order, totalCount: order.length, success: true });
});

// Export All Data in CSV
const exportData = asyncHandler(async (req, res) => {
  const restaurantId = 830;

  const query = `
  SELECT
  o.id,
  o.odate,
  o.o_total,
  o.payment_status,
  r.title AS restaurant_title,
  dp.dp_name AS delivery_partner_name,
  u.name AS username,
  u.mobile AS usermobile,
  addr.address AS user_address,
  addr.pincode AS pincode,
  addr.city AS city,
  addr.state AS state,
  (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus
FROM tbl_order o
LEFT JOIN tbl_user u ON o.uid = u.id
LEFT JOIN rest_details r ON o.rest_id = r.id
LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
LEFT JOIN tbl_address addr ON addr.id = o.address_id
WHERE rest_id = ?
GROUP BY
  o.id,
  u.name, u.email, u.mobile,
  r.title, r.rimg, r.mobile,
  addr.address,
  addr.pincode,
  addr.city,
  addr.state
ORDER BY o.odate DESC
    `;

  const [order] = await pool.query(query, [restaurantId]);
  if (!order || order.length === 0) {
    res.status(404);
    throw new Error("Order not found!");
  }

  // Convert query results to CSV format
  const csvData = order.map((row) =>
    [
      row.id,
      row.odate,
      row.o_total,
      row.payment_status,
      row.restaurant_title,
      row.delivery_partner_name,
      row.username,
      row.usermobile,
      row.user_address,
      row.pincode,
      row.city,
      row.tate,
      row.orderstatus,
    ].join(",")
  );

  // Add headers to the CSV data
  const headers = [
    "Order ID",
    "Order Date",
    "Order Total",
    "Payment Status",
    "Restaurant Title",
    "Delivery Partner Name",
    "Username",
    "Usermobile",
    "User Address",
    "User Pincode",
    "User City",
    "User State",
    "Order Status",
  ];
  csvData.unshift(headers.join(","));

  const csvContent = csvData.join("\n");

  // Set the response headers
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="orders.csv"`);

  // Send the CSV content as the response
  res.status(200).send(csvContent);
});

// Export Payment Success Data in CSV
const exportPayementSuccessData = asyncHandler(async (req, res) => {
  const restaurantId = 830;

  const query = `
    SELECT
      o.id,
      o.odate,
      o.o_total,
      o.payment_status,
      r.title AS restaurant_title,
      dp.dp_name AS delivery_partner_name,
      u.name AS username,
      u.mobile AS usermobile,
      addr.address AS user_address,
      addr.pincode AS pincode,
      addr.city AS city,
      addr.state AS state,
      (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus
    FROM tbl_order o
    LEFT JOIN tbl_user u ON o.uid = u.id
    LEFT JOIN rest_details r ON o.rest_id = r.id
    LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
    LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
    LEFT JOIN tbl_address addr ON addr.id = o.address_id
    WHERE rest_id = ? AND payment_status = 'Success' AND o_total = 100 AND cc_orderid IS NOT NULL
    GROUP BY
      o.id,
      u.name, u.email, u.mobile,
      r.title, r.rimg, r.mobile,
      addr.address,
      addr.pincode,
      addr.city,
      addr.state
    ORDER BY o.odate DESC
  `;

  const [order] = await pool.query(query, [restaurantId]);

  if (!order || order.length === 0) {
    res.status(404);
    throw new Error("Order not found!");
  }

  // Convert query results to CSV format
  const csvData = order.map((row) =>
    [
      row.id,
      row.odate,
      row.o_total,
      row.payment_status,
      row.restaurant_title,
      row.delivery_partner_name,
      row.username,
      row.usermobile,
      row.user_address,
      row.pincode,
      row.city,
      row.state,
      row.orderstatus,
    ].join(",")
  );

  // Add headers to the CSV data
  const headers = [
    "Order ID",
    "Order Date",
    "Order Total",
    "Payment Status",
    "Restaurant Title",
    "Delivery Partner Name",
    "Username",
    "Usermobile",
    "User Address",
    "User Pincode",
    "User City",
    "User State",
    "Order Status",
  ];
  csvData.unshift(headers.join(","));

  const csvContent = csvData.join("\n");

  // Set the response headers including UTF-8 encoding
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="orders.csv"`);

  // Send the CSV content as the response
  res.status(200).send(csvContent);
});

const addOrderHistory = asyncHandler(async (req, res) => {
  const { ostatus, orderId, tracking_id, tracking_url } = req.body;

  if (!ostatus) {
    res.status(400);
    throw new Error("Please provide the order status.");
  }
  if (!orderId) {
    res.status(400);
    throw new Error("Please provide the orderId.");
  }

  let orderstatus;

  if (ostatus === "Accept") {
    orderstatus = 1;
  } else if (ostatus === "On Route") {
    orderstatus = 6;
  } else if (ostatus === "Completed") {
    orderstatus = 7;
  }

  let insertHistoryQuery;
  let queryParams;
  let updateOrderQuery;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("SET `time_zone` = '+05:30'");

    let affectedRowsHistory = 0;
    let affectedRowsOrder = 0;

    if (orderstatus === 6) {
      console.log("On Route");
      insertHistoryQuery = `
        INSERT INTO tbl_order_history (ostatus, orderstatus, orderid, date_time, tracking_id, tracking_url)
        VALUES (?, ?, ?, NOW(), ?, ?);
      `;
      queryParams = [ostatus, orderstatus, orderId, tracking_id, tracking_url];

      const historyResult = await connection.query(
        insertHistoryQuery,
        queryParams
      );
      affectedRowsHistory = historyResult[0].affectedRows;

      updateOrderQuery = `
        UPDATE tbl_order
        SET o_status = ?, order_status = ?
        WHERE id = ?;
      `;
      queryParams = [ostatus, orderstatus, orderId];

      const orderResult = await connection.query(updateOrderQuery, queryParams);
      affectedRowsOrder = orderResult[0].affectedRows;
    } else if (orderstatus === 1) {
      console.log("Accept");
      insertHistoryQuery = `
        INSERT INTO tbl_order_history (ostatus, orderstatus, orderid, date_time)
        VALUES (?, ?, ?, NOW());
      `;
      queryParams = [ostatus, orderstatus, orderId];

      // Execute the first insert query for orderstatus 1
      const historyResult1 = await connection.query(
        insertHistoryQuery,
        queryParams
      );
      affectedRowsHistory = historyResult1[0].affectedRows;

      // Update queryParams for the second insert query
      queryParams = ["Processing", 4, orderId];

      // Insert the second row with different values
      insertHistoryQuery = `
        INSERT INTO tbl_order_history (ostatus, orderstatus, orderid, date_time)
        VALUES (?, ?, ?, NOW());
      `;

      // Execute the second insert query for orderstatus 1
      const historyResult2 = await connection.query(
        insertHistoryQuery,
        queryParams
      );
      affectedRowsHistory += historyResult2[0].affectedRows;

      updateOrderQuery = `
        UPDATE tbl_order
        SET o_status = ?, order_status = ?
        WHERE id = ?;
      `;
      queryParams = ["Processing", 4, orderId];

      const orderResult = await connection.query(updateOrderQuery, queryParams);
      affectedRowsOrder = orderResult[0].affectedRows;
    } else if (orderstatus === 7) {
      insertHistoryQuery = `
        INSERT INTO tbl_order_history (ostatus, orderstatus, orderid, date_time)
        VALUES (?, ?, ?, NOW());
      `;
      queryParams = [ostatus, orderstatus, orderId];

      // Execute insert query for orderstatus other than 6 or 1
      const historyResult = await connection.query(
        insertHistoryQuery,
        queryParams
      );
      affectedRowsHistory = historyResult[0].affectedRows;

      updateOrderQuery = `
        UPDATE tbl_order
        SET o_status = ?, order_status = ?
        WHERE id = ?;
      `;
      queryParams = ["Completed", 7, orderId];

      const orderResult = await connection.query(updateOrderQuery, queryParams);
      affectedRowsOrder = orderResult[0].affectedRows;
    }

    await connection.commit();

    res.status(200).json({
      message: "Order history updated successfully.",
      success: true,
      affectedRowsHistory,
      affectedRowsOrder,
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

module.exports = {
  getRestaurantDetails,
  searchData,
  exportData,
  exportPayementSuccessData,
  addOrderHistory,
};
