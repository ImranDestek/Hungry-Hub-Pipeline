const pool = require("../db/pool");
const asyncHandler = require("express-async-handler");
const moment = require("moment-timezone");

// @ POST /all
const getAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req?.query?.page) || 1;

  const limit = 8; // show 8 orders

  const offset = (page - 1) * limit;

  const status = req?.body?.status;
  const orderId = req?.query?.orderId;

  let order_status_num = null;
  let ordersQuery;
  let ordersParams;

  if (status === "pending") {
    order_status_num = 0;
  } else if (status === "processing") {
    order_status_num = 4;
  } else if (status === "delivered") {
    order_status_num = 7;
  } else if (status === "cancelled") {
    order_status_num = 2;
  } else if (status === "accept") {
    order_status_num = 1;
  }

  if (orderId) {
    ordersQuery = `
      SELECT o.id,
             o.uid,
             o.rest_id,
             o.odate,
             o.p_method_id,
             o.address_id,
             o.address,
             o.d_charge,
             o.rest_charge,
             o.delivertime,
             o.o_total,
             o.subtotal,
             o.a_note,
             o.o_status,
             o.a_status,
             o.rid,
             o.order_status,
             o.cancel_reason,
             o.tax,
             o.tip,
             o.rest_charge,
             o.dp_type,
             o.self_pickup,
             o.payment_status,
             o.order_comment,
             u.name AS username,
             u.email AS user_email,
             u.mobile AS user_mobile,
             r.title AS restaurant_title,
             r.rimg AS restaurant_image,
             r.mobile AS restaurant_mobile,
            r.full_address AS restaurant_address,
             dp.dp_name AS delivery_partner_name,
             (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus,
             (SELECT p.title FROM tbl_payment_list p WHERE p.id = o.p_method_id LIMIT 1) AS payment_type,
             (SELECT a.address FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_address,
             (SELECT a.houseno FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_houseno,
             (SELECT a.landmark FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_landmark,
             (SELECT GROUP_CONCAT(pt.ptitle) FROM tbl_order_product pt WHERE pt.oid = o.id) AS ptitle,
             (SELECT GROUP_CONCAT(pa.addon) FROM tbl_order_product pa WHERE pa.oid = o.id) AS addon,
             (SELECT GROUP_CONCAT(pq.pquantity) FROM tbl_order_product pq WHERE pq.oid = o.id) AS pquantity,
             (SELECT GROUP_CONCAT(pp.pprice) FROM tbl_order_product pp WHERE pp.oid = o.id) AS pprice,             
             (SELECT c.title FROM addon_cat c WHERE c.rid = o.rest_id LIMIT 1) AS category,
             JSON_ARRAYAGG(
              JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
            ) AS order_history
      FROM tbl_order o
      LEFT JOIN tbl_user u ON o.uid = u.id
      LEFT JOIN rest_details r ON o.rest_id = r.id
      LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
      LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
      WHERE DATE(o.odate) = CURDATE() AND o.id = ?
      GROUP BY
      o.id,
      u.name, u.email, u.mobile,
      r.title, r.rimg, r.mobile
    `;
    ordersParams = [orderId, limit, offset];
  } else if (order_status_num !== null) {
    ordersQuery = `
      SELECT o.id,
             o.uid,
             o.rest_id,
             o.odate,
             o.p_method_id,
             o.address_id,
             o.address,
             o.d_charge,
             o.rest_charge,
             o.delivertime,
             o.o_total,
             o.subtotal,
             o.a_note,
             o.o_status,
             o.a_status,
             o.rid,
             o.order_status,
             o.cancel_reason,
             o.tax,
             o.tip,
             o.rest_charge,
             o.dp_type,
             o.self_pickup,
             o.payment_status,
             o.order_comment,
             u.name AS username,
             u.email AS user_email,
             u.mobile AS user_mobile,
             r.title AS restaurant_title,
             r.rimg AS restaurant_image,
             r.mobile AS restaurant_mobile,
              r.full_address AS restaurant_address,
             dp.dp_name AS delivery_partner_name,
             (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus,
             (SELECT p.title FROM tbl_payment_list p WHERE p.id = o.p_method_id LIMIT 1) AS payment_type,
             (SELECT a.address FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_address,
             (SELECT a.houseno FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_houseno,
             (SELECT a.landmark FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_landmark,
             (SELECT GROUP_CONCAT(pt.ptitle) FROM tbl_order_product pt WHERE pt.oid = o.id) AS ptitle,
             (SELECT GROUP_CONCAT(pa.addon) FROM tbl_order_product pa WHERE pa.oid = o.id) AS addon,
             (SELECT GROUP_CONCAT(pq.pquantity) FROM tbl_order_product pq WHERE pq.oid = o.id) AS pquantity,
             (SELECT GROUP_CONCAT(pp.pprice) FROM tbl_order_product pp WHERE pp.oid = o.id) AS pprice,             
             (SELECT c.title FROM addon_cat c WHERE c.rid = o.rest_id LIMIT 1) AS category,
             JSON_ARRAYAGG(
              JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
            ) AS order_history
      FROM tbl_order o
      LEFT JOIN tbl_user u ON o.uid = u.id
      LEFT JOIN rest_details r ON o.rest_id = r.id
      LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
      LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
      WHERE payment_status <> 'Aborted' AND o.order_status = ?
      AND DATE(o.odate) = CURDATE()
      GROUP BY
      o.id,
      u.name, u.email, u.mobile,
      r.title, r.rimg, r.mobile
      ORDER BY o.odate DESC
      LIMIT ? OFFSET ?
    `;

    ordersParams = [order_status_num, limit, offset];
  } else if (status === "abort") {
    console.log("Abort");
    ordersQuery = `
    SELECT 
    o.id,
    o.uid,
    o.rest_id,
    o.odate,
    o.p_method_id,
    o.address_id,
    o.address,
    o.d_charge,
    o.rest_charge,
    o.delivertime,
    o.o_total,
    o.subtotal,
    o.a_note,
    o.o_status,
    o.a_status,
    o.rid,
    o.order_status,
    o.cancel_reason,
    o.tax,
    o.tip,
    o.rest_charge,
    o.dp_type,
    o.self_pickup,
    o.payment_status,
    o.order_comment,
    u.name AS username,
    u.email AS user_email,
    u.mobile AS user_mobile,
    r.title AS restaurant_title,
    r.rimg AS restaurant_image,
    r.mobile AS restaurant_mobile,
    r.full_address AS restaurant_address,
    dp.dp_name AS delivery_partner_name,
    (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus,
    (SELECT p.title FROM tbl_payment_list p WHERE p.id = o.p_method_id LIMIT 1) AS payment_type,
    (SELECT a.address FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_address,
    (SELECT a.houseno FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_houseno,
    (SELECT a.landmark FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_landmark,
    (SELECT GROUP_CONCAT(pt.ptitle) FROM tbl_order_product pt WHERE pt.oid = o.id) AS ptitle,
    (SELECT GROUP_CONCAT(pa.addon) FROM tbl_order_product pa WHERE pa.oid = o.id) AS addon,
    (SELECT GROUP_CONCAT(pq.pquantity) FROM tbl_order_product pq WHERE pq.oid = o.id) AS pquantity,
    (SELECT GROUP_CONCAT(pp.pprice) FROM tbl_order_product pp WHERE pp.oid = o.id) AS pprice,             
    (SELECT c.title FROM addon_cat c WHERE c.rid = o.rest_id LIMIT 1) AS category,
    JSON_ARRAYAGG(
      JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
    ) AS order_history
  FROM tbl_order o
  LEFT JOIN tbl_user u ON o.uid = u.id
  LEFT JOIN rest_details r ON o.rest_id = r.id
  LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
  LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
  WHERE (payment_status = 'Aborted' OR payment_status = 'Failure')
  AND DATE(o.odate) = CURDATE()
  GROUP BY
    o.id,
    u.name, u.email, u.mobile,
    r.title, r.rimg, r.mobile
  ORDER BY o.odate DESC
  LIMIT ? OFFSET ?
  `;

    ordersParams = [limit, offset];
  } else {
    console.log("ALL");
    ordersQuery = `
      SELECT 
      o.id,
      o.uid,
      o.rest_id,
      o.odate,
      o.p_method_id,
      o.address_id,
      o.address,
      o.d_charge,
      o.rest_charge,
      o.delivertime,
      o.o_total,
      o.subtotal,
      o.a_note,
      o.o_status,
      o.a_status,
      o.rid,
      o.order_status,
      o.cancel_reason,
      o.tax,
      o.tip,
      o.rest_charge,
      o.dp_type,
      o.self_pickup,
      o.payment_status,
      o.order_comment,
      u.name AS username,
      u.email AS user_email,
      u.mobile AS user_mobile,
      r.title AS restaurant_title,
      r.rimg AS restaurant_image,
      r.mobile AS restaurant_mobile,
      r.full_address AS restaurant_address,
      dp.dp_name AS delivery_partner_name,
      (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus,
      (SELECT p.title FROM tbl_payment_list p WHERE p.id = o.p_method_id LIMIT 1) AS payment_type,
      (SELECT a.address FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_address,
      (SELECT a.houseno FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_houseno,
      (SELECT a.landmark FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_landmark,
      (SELECT GROUP_CONCAT(pt.ptitle) FROM tbl_order_product pt WHERE pt.oid = o.id) AS ptitle,
      (SELECT GROUP_CONCAT(pa.addon) FROM tbl_order_product pa WHERE pa.oid = o.id) AS addon,
      (SELECT GROUP_CONCAT(pq.pquantity) FROM tbl_order_product pq WHERE pq.oid = o.id) AS pquantity,
      (SELECT GROUP_CONCAT(pp.pprice) FROM tbl_order_product pp WHERE pp.oid = o.id) AS pprice,             
      (SELECT c.title FROM addon_cat c WHERE c.rid = o.rest_id LIMIT 1) AS category,
      JSON_ARRAYAGG(
        JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
      ) AS order_history
    FROM tbl_order o
    LEFT JOIN tbl_user u ON o.uid = u.id
    LEFT JOIN rest_details r ON o.rest_id = r.id
    LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
    LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
    WHERE DATE(o.odate) = CURDATE()
    GROUP BY
      o.id,
      u.name, u.email, u.mobile,
      r.title, r.rimg, r.mobile
    ORDER BY o.odate DESC
    LIMIT ? OFFSET ?
    `;

    ordersParams = [limit, offset];
  }

  const [ordersResult] = await pool.query(ordersQuery, ordersParams);

  // Assuming ordersResult is your response object
  const modifiedOrdersResult = ordersResult.map((order) => ({
    ...order,
    items: order.ptitle
      ? order.ptitle.split(",").map((ptitle, index) => ({
          ptitle,
          addon: order.addon ? order.addon.split(",")[index] : "",
          pquantity: order.pquantity ? order.pquantity.split(",")[index] : "",
          pprice: order.pprice ? order.pprice.split(",")[index] : "",
        }))
      : [],
  }));

  if (!modifiedOrdersResult || modifiedOrdersResult.length === 0) {
    res.status(404);
    throw new Error("No orders found.");
  }

  const totalCountQuery = `SELECT COUNT(*) AS total FROM tbl_order WHERE DATE(odate) = CURDATE()`;
  const processingcountQuery = `
  SELECT COUNT(*) AS total
  FROM tbl_order
  WHERE DATE(odate) = CURDATE() AND payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 4;
`;

  const deliveredCountQuery = `
  SELECT COUNT(*) AS total
  FROM tbl_order
  WHERE DATE(odate) = CURDATE() AND payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 7;
`;

  const cancelledCountQuery = `
  SELECT COUNT(*) AS total
  FROM tbl_order
  WHERE DATE(odate) = CURDATE() AND payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 2;
`;

  const pendingCountQuery = `
  SELECT COUNT(*) AS total
  FROM tbl_order
  WHERE DATE(odate) = CURDATE() AND payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 0;
`;

  const acceptCountQuery = `
  SELECT COUNT(*) AS total
  FROM tbl_order
  WHERE DATE(odate) = CURDATE() AND payment_status <> 'Aborted' AND payment_status <> 'Failure' AND order_status = 1;
`;

  const abortCountQuery = `
  SELECT COUNT(*) AS total
  FROM tbl_order
  WHERE DATE(odate) = CURDATE() AND (payment_status = 'Aborted' OR payment_status = 'Failure');
`;

  const [countResult] = await pool.query(totalCountQuery);
  const [countResultPending] = await pool.query(pendingCountQuery);
  const [countResultProcessing] = await pool.query(processingcountQuery);
  const [countResultDelivered] = await pool.query(deliveredCountQuery);
  const [countResultCancelled] = await pool.query(cancelledCountQuery);
  const [countResultAccept] = await pool.query(acceptCountQuery);
  const [countResultAbort] = await pool.query(abortCountQuery);

  const totalOrders = countResult[0].total;
  const totalPendingOrders = countResultPending[0].total;
  const totalProcessingOrders = countResultProcessing[0].total;
  const totalDeliveredOrders = countResultDelivered[0].total;
  const totalCancelledOrders = countResultCancelled[0].total;
  const totalAcceptedOrders = countResultAccept[0].total;
  const totalAbortOrders = countResultAbort[0].total;

  res.status(200).json({
    orders: modifiedOrdersResult,
    totalCount: totalOrders,
    pendingCount: totalPendingOrders,
    processingCount: totalProcessingOrders,
    deliveredCount: totalDeliveredOrders,
    cancelledCount: totalCancelledOrders,
    acceptedCount: totalAcceptedOrders,
    abortedCount: totalAbortOrders,
    success: true,
  });
});

// @GET /all
const fetchAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req?.query?.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const ordersQuery = `
    SELECT
      o.id,
      o.odate,
      o.o_total,
      o.dp_type,
      o.payment_status,
      o.o_status,
      u.name AS username,
      r.title AS restaurant_title,
      dp.dp_name AS delivery_partner_name,
      (SELECT p.title FROM tbl_payment_list p WHERE p.id = o.p_method_id LIMIT 1) AS payment_type,
      JSON_ARRAYAGG(
        JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
      ) AS order_history
    FROM
      tbl_order o
      LEFT JOIN tbl_user u ON o.uid = u.id
      LEFT JOIN rest_details r ON o.rest_id = r.id
      LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
      LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
    GROUP BY
      o.id,
      u.name,
      r.title
    ORDER BY
      o.odate DESC
    LIMIT ? OFFSET ?;
  `;

  const ordersParams = [limit, offset];

  try {
    const [ordersResult] = await pool.query(ordersQuery, ordersParams);

    if (!ordersResult || ordersResult.length === 0) {
      res.status(404);
      throw new Error("No orders found.");
    }

    const totalCountQuery = `SELECT COUNT(*) AS total FROM tbl_order`;
    const [countResult] = await pool.query(totalCountQuery);
    const totalOrders = countResult[0].total;

    res.status(200).json({
      orders: ordersResult,
      totalCount: totalOrders,
      success: true,
    });
  } catch (error) {
    console.error("Error executing MySQL query:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// @desc Get user order
// @route GET /api/order/:id
const getSingleOrder = asyncHandler(async (req, res) => {
  const orderId = parseInt(req?.params?.id);

  if (!orderId) {
    res.status(400);
    throw new Error("Please provide the order ID.");
  }

  const orderQuery = `
  SELECT o.id,
  o.uid,
  o.rest_id,
  o.odate,
  o.p_method_id,
  o.address_id,
  o.address,
  o.d_charge,
  o.rest_charge,
  o.delivertime,
  o.o_total,
  o.subtotal,
  o.a_note,
  o.o_status,
  o.a_status,
  o.rid,
  o.order_status,
  o.cancel_reason,
  o.tax,
  o.tip,
  o.rest_charge,
  o.dp_type,
  o.self_pickup,
  o.payment_status,
  o.order_comment,
  u.name AS username,
  u.email AS user_email,
  u.mobile AS user_mobile,
  r.title AS restaurant_title,
  r.rimg AS restaurant_image,
  r.mobile AS restaurant_mobile,
  r.full_address AS restaurant_address,
  dp.dp_name AS delivery_partner_name,
  (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus,
  (SELECT p.title FROM tbl_payment_list p WHERE p.id = o.p_method_id LIMIT 1) AS payment_type,
  (SELECT a.address FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_address,
  (SELECT a.houseno FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_houseno,
  (SELECT a.landmark FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_landmark,
  (SELECT GROUP_CONCAT(pt.ptitle) FROM tbl_order_product pt WHERE pt.oid = o.id) AS ptitle,
  (SELECT GROUP_CONCAT(pa.addon) FROM tbl_order_product pa WHERE pa.oid = o.id) AS addon,
  (SELECT GROUP_CONCAT(pq.pquantity) FROM tbl_order_product pq WHERE pq.oid = o.id) AS pquantity,
  (SELECT GROUP_CONCAT(pp.pprice) FROM tbl_order_product pp WHERE pp.oid = o.id) AS pprice,             
  (SELECT c.title FROM addon_cat c WHERE c.rid = o.rest_id LIMIT 1) AS category,
  JSON_ARRAYAGG(
   JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
 ) AS order_history
FROM tbl_order o
LEFT JOIN tbl_user u ON o.uid = u.id
LEFT JOIN rest_details r ON o.rest_id = r.id
LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
WHERE o.id = ?
GROUP BY
o.id,
u.name, u.email, u.mobile,
r.title, r.rimg, r.mobile
`;

  const [orderResult] = await pool.query(orderQuery, [orderId]);

  const modifiedOrdersResult = orderResult.map((order) => ({
    ...order,
    items: order.ptitle
      ? order.ptitle.split(",").map((ptitle, index) => ({
          ptitle,
          addon: order.addon ? order.addon.split(",")[index] : "",
          pquantity: order.pquantity ? order.pquantity.split(",")[index] : "",
          pprice: order.pprice ? order.pprice.split(",")[index] : "",
        }))
      : [],
  }));

  if (!modifiedOrdersResult || modifiedOrdersResult.length === 0) {
    res.status(404);
    throw new Error("Order not found.");
  }

  res.status(200).json({ order: modifiedOrdersResult[0], success: true });
});

// @ GET /search/:id
const searchOrder = asyncHandler(async (req, res) => {
  const orderId = req?.query?.id;

  const ordersQuery = `
    SELECT
      o.id,
      o.odate,
      o.o_total,
      o.dp_type,
      o.payment_status,
      o.o_status,
      u.name AS username,
      r.title AS restaurant_title,
      dp.dp_name AS delivery_partner_name,
      JSON_ARRAYAGG(
        JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
      ) AS order_history
    FROM
      tbl_order o
      LEFT JOIN tbl_user u ON o.uid = u.id
      LEFT JOIN rest_details r ON o.rest_id = r.id
      LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
      LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
    WHERE
      o.id = ?
    GROUP BY
      o.id,
      u.name,
      r.title
    ORDER BY
      o.odate DESC;
  `;

  let ordersParams = [orderId];

  const [ordersResult] = await pool.query(ordersQuery, ordersParams);

  if (!ordersResult || ordersResult.length === 0) {
    res.status(404);
    throw new Error("No orders found.");
  }

  res.status(200).json({
    orders: ordersResult,
    success: true,
  });
});

// Search ALl Orders
// /api/order/search?q=${query}&page=1
// const searchOrder = asyncHandler(async (req, res) => {
//   const page = parseInt(req?.query?.page) || 1;
//   const limit = 8;
//   const offset = (page - 1) * limit;

//   const query = req.query.q;

//   const totalCountQuery = `
//     SELECT COUNT(*) AS total FROM tbl_order o
//     LEFT JOIN tbl_user u ON o.uid = u.id
//     LEFT JOIN rest_details r ON o.rest_id = r.id
//     LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
//     LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
//     WHERE o.id LIKE ? OR u.name LIKE ? OR r.title LIKE ? OR dp.dp_name LIKE ?
//     GROUP BY o.id, u.name, r.title;
//   `;

//   const totalCountParams = [
//     `%${query}%`,
//     `%${query}%`,
//     `%${query}%`,
//     `%${query}%`,
//   ];

//   const [totalCountResult] = await pool.query(
//     totalCountQuery,
//     totalCountParams
//   );

//   const totalCount = totalCountResult[0].total;

//   const ordersQuery = `
//     SELECT
//       o.id,
//       o.odate,
//       o.o_total,
//       o.dp_type,
//       o.payment_status,
//       u.name AS username,
//       r.title AS restaurant_title,
//       dp.dp_name AS delivery_partner_name,
//       JSON_ARRAYAGG(
//         JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
//       ) AS order_history
//     FROM
//       tbl_order o
//       LEFT JOIN tbl_user u ON o.uid = u.id
//       LEFT JOIN rest_details r ON o.rest_id = r.id
//       LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
//       LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
//     WHERE
//       o.id LIKE ? OR u.name LIKE ? OR r.title LIKE ? OR dp.dp_name LIKE ?
//     GROUP BY
//       o.id,
//       u.name,
//       r.title
//     ORDER BY
//       o.odate DESC
//     LIMIT ? OFFSET ?;
//   `;

//   const ordersParams = [
//     `%${query}%`,
//     `%${query}%`,
//     `%${query}%`,
//     `%${query}%`,
//     limit,
//     offset,
//   ];

//   const [ordersResult] = await pool.query(ordersQuery, ordersParams);

//   if (!ordersResult || ordersResult.length === 0) {
//     res.status(404).json({ message: "No orders found!", success: false });
//     throw new Error("No orders found.");
//   }

//   res.status(200).json({
//     orders: ordersResult,
//     totalCount: totalCount,
//     success: true,
//   });
// });

// /api/live-search
const searchLiveOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req?.query?.page) || 1;
  const limit = 8;
  const offset = (page - 1) * limit;

  const query = req.query.q;

  const totalCountQuery = `
    SELECT COUNT(*) AS total 
    FROM tbl_order o
    LEFT JOIN tbl_user u ON o.uid = u.id
    LEFT JOIN rest_details r ON o.rest_id = r.id
    LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
    LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
    WHERE (o.id = ? OR u.name LIKE ? OR r.title LIKE ? OR dp.dp_name LIKE ?)
      AND DATE(o.odate) = CURDATE();
  `;

  const totalCountParams = [query, `%${query}%`, `%${query}%`, `%${query}%`];

  const [totalCountResult] = await pool.query(
    totalCountQuery,
    totalCountParams
  );
  const totalCount = totalCountResult[0].total;

  const orderQuery = `
    SELECT o.id,
      o.uid,
      o.rest_id,
      o.odate,
      o.p_method_id,
      o.address_id,
      o.address,
      o.d_charge,
      o.rest_charge,
      o.delivertime,
      o.o_total,
      o.subtotal,
      o.a_note,
      o.o_status,
      o.a_status,
      o.rid,
      o.order_status,
      o.cancel_reason,
      o.tax,
      o.tip,
      o.rest_charge,
      o.dp_type,
      o.self_pickup,
      o.payment_status,
      o.order_comment,
      u.name AS username,
      u.email AS user_email,
      u.mobile AS user_mobile,
      r.title AS restaurant_title,
      r.rimg AS restaurant_image,
      r.mobile AS restaurant_mobile,
      r.full_address AS restaurant_address,
      dp.dp_name AS delivery_partner_name,
      (SELECT oh.ostatus FROM tbl_order_history oh WHERE oh.orderstatus = o.order_status LIMIT 1) AS orderstatus,
      (SELECT p.title FROM tbl_payment_list p WHERE p.id = o.p_method_id LIMIT 1) AS payment_type,
      (SELECT a.address FROM tbl_address a WHERE a.id = o.address_id LIMIT 1) AS user_address,
      (SELECT GROUP_CONCAT(pt.ptitle) FROM tbl_order_product pt WHERE pt.oid = o.id) AS ptitle,
      (SELECT GROUP_CONCAT(pa.addon) FROM tbl_order_product pa WHERE pa.oid = o.id) AS addon,
      (SELECT GROUP_CONCAT(pq.pquantity) FROM tbl_order_product pq WHERE pq.oid = o.id) AS pquantity,
      (SELECT GROUP_CONCAT(pp.pprice) FROM tbl_order_product pp WHERE pp.oid = o.id) AS pprice,             
      (SELECT c.title FROM addon_cat c WHERE c.rid = o.rest_id LIMIT 1) AS category,
      JSON_ARRAYAGG(
        JSON_OBJECT('ostatus', oh.ostatus, 'date_time', oh.date_time)
      ) AS order_history
    FROM tbl_order o
      LEFT JOIN tbl_user u ON o.uid = u.id
      LEFT JOIN rest_details r ON o.rest_id = r.id
      LEFT JOIN tbl_order_history oh ON oh.orderid = o.id
      LEFT JOIN delivery_partner dp ON dp.dp_id = o.d_partner
    WHERE (o.id = ? OR u.name LIKE ? OR r.title LIKE ? OR dp.dp_name LIKE ?)
      AND DATE(o.odate) = CURDATE()
    GROUP BY
      o.id,
      u.name, u.email, u.mobile,
      r.title, r.rimg, r.mobile
    ORDER BY
      o.odate DESC
    LIMIT ? OFFSET ?;
  `;

  const ordersParams = [
    query,
    `%${query}%`,
    `%${query}%`,
    `%${query}%`,
    limit,
    offset,
  ];

  const [orderResult] = await pool.query(orderQuery, ordersParams);

  const modifiedOrdersResult = orderResult.map((order) => ({
    ...order,
    items: order.ptitle
      ? order.ptitle.split(",").map((ptitle, index) => ({
          ptitle,
          addon: order.addon ? order.addon.split(",")[index] : "",
          pquantity: order.pquantity ? order.pquantity.split(",")[index] : "",
          pprice: order.pprice ? order.pprice.split(",")[index] : "",
        }))
      : [],
  }));

  if (!modifiedOrdersResult || modifiedOrdersResult.length === 0) {
    res.status(404);
    throw new Error("Order not found.");
  }

  res.status(200).json({
    orders: modifiedOrdersResult,
    totalCount,
    success: true,
  });
});

// @desc Add order comment
// @route POST /api/order/comment
const createOrderComment = asyncHandler(async (req, res) => {
  try {
    const orderId = req?.body?.orderId;
    const comment = req?.body?.comment;

    console.log({ orderId, comment });

    if (!orderId || !comment) {
      res.status(400).json({ error: "Order Id and Comment are required" });
      return;
    }

    const updateCommentQuery = `
      UPDATE tbl_order
      SET order_comment = ?
      WHERE id = ?;
    `;

    try {
      await pool.query(updateCommentQuery, [comment, orderId]);
      res.status(200).json({
        success: true,
        comment: comment,
      });
    } catch (error) {
      console.error("Error updating comment. Column Not Found", error);
    }
  } catch (error) {
    console.error("Error adding comment.", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const cancelReasonDropdown = asyncHandler(async (req, res) => {
  const data = [
    "Buyer wants to modify address / other order details",
    "Product available at lower than order price",
    "Price of one or more items have changed due to which buyer was asked to make additional payment",
    "Order is taking too long to be accepted",
  ];

  res.status(200).send(data);
});

const cancelOrder = asyncHandler(async (req, res) => {
  let { oid, cancel_reason, cancel_comment } = req.body;

  if (!oid) {
    return res
      .status(400)
      .json({ message: "Order Id (oid) is required", success: false });
  }
  if (!cancel_reason) {
    return res
      .status(400)
      .json({ message: "cancel_reason is required", success: false });
  }
  if (!cancel_comment) {
    cancel_comment = "";
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updateQuery = `UPDATE tbl_order SET o_status = 'Cancelled', a_status = '2', order_status = '2', cancel_by = 'Buyer', cancel_reason = ?, cancel_comment = ? WHERE id = ?`;

    await connection.query(updateQuery, [cancel_reason, cancel_comment, oid]);

    const currentDateTime = moment()
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    const updateTableHistoryQuery = `INSERT INTO tbl_order_history (ostatus, orderstatus, orderid, date_time) VALUES ('Cancelled', '2', ?, ?)`;

    await connection.query(updateTableHistoryQuery, [oid, currentDateTime]);

    await connection.commit();

    res.status(200).json({
      message: "Order Cancelled Successfully",
      success: true,
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: "Order Cancellation Failed",
      success: false,
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

module.exports = {
  getAllOrders,
  getSingleOrder,
  createOrderComment,
  fetchAllOrders,
  searchOrder,
  searchLiveOrders,
  cancelReasonDropdown,
  cancelOrder,
};
