// const mysql = require("mysql2/promise");

// Create a connection pool
const pool = require("../db/pool");

const createOrdersTableQuery = `
  CREATE TABLE IF NOT EXISTS tbl_order (
    id INT(11) DEFAULT 'None' NOT NULL AUTO_INCREMENT,
    user_id INT(11) NULL,
    rest_id INT(11) NULL,
    odate DATETIME NULL,
    p_method_id INT(11) NULL,
    address TEXT COLLATE utf8_general_ci NULL,
    address_id INT(11) DEFAULT 0 NOT NULL,
    d_charge FLOAT NULL,
    d_distance VARCHAR(20) DEFAULT 0 COLLATE latin1_swedish_ci NOT NULL COMMENT 'delivery distance',
    cou_id FLOAT NULL,
    cou_amt FLOAT NULL,
    o_total FLOAT NULL,
    subtotal FLOAT NULL,
    trans_id TEXT COLLATE latin1_swedish_ci NULL,
    a_note TEXT COLLATE utf8_general_ci NULL,
    o_status ENUM('Pending', 'Processing', 'On Route', 'Completed', 'Cancelled', 'Ready For Pickup') DEFAULT 'PENDING' COLLATE latin1_swedish_ci NULL,
    a_status INT(11) DEFAULT 0 NULL,
    rid INT(11) DEFAULT 0 NULL,
    order_status INT(11) DEFAULT 0 NULL,
    comment_reject TEXT COLLATE utf8_general_ci NULL,
    vcommission FLOAT NULL,
    dcommission FLOAT DEFAULT 0 NULL,
    wall_amt FLOAT NULL,
    tax FLOAT NULL,
    tip INT(11) NULL,
    rest_charge INT(11) NULL,
    lats TEXT COLLATE latin1_swedish_ci NULL,
    longs TEXT COLLATE latin1_swedish_ci NULL,
    delivertime DATETIME NULL,
    atype TEXT DEFAULT 'address type' COLLATE latin1_swedish_ci NULL,
    rlats TEXT COLLATE latin1_swedish_ci NULL,
    rlongs TEXT COLLATE latin1_swedish_ci NULL,
    rest_store INT(11) DEFAULT 0 COMMENT 'restaurant rating',
    rest_title TEXT COLLATE utf8_general_ci NULL,
    rider_rate INT(11) DEFAULT 0 COMMENT 'rider rating',
    rider_title TEXT COLLATE utf8_general_ci NULL,
    otp VARCHAR(20) COLLATE latin1_swedish_ci NULL COMMENT 'delivery boy enter this otp when pickup order from restaurant',
    del_otp VARCHAR(20) COLLATE latin1_swedish_ci NULL COMMENT 'delivery boy enter this otp when drop order on customer',
    d_partner INT(11) DEFAULT 0 NOT NULL COMMENT 'it came from delivery_partner table',
    dp_type INT(11) DEFAULT 0 NOT NULL COMMENT '1=owndeliveryboy,2=Sefl Delivery,3=DUNZO',
    feedback_dt DATETIME,
    self_pickup INT(11) DEFAULT 0 NOT NULL COMMENT '1=self pickup, 0=delivery',
    deltime INT(11) NULL,
    cc_orderid VARCHAR(30) COLLATE latin1_swedish_ci NULL,
    payment_status VARCHAR(30) DEFAULT 'PENDING' COLLATE latin1_swedish_ci NULL,
    cancel_by VARCHAR(30) COLLATE latin1_swedish_ci NULL,
    cancel_reason TEXT COLLATE latin1_swedish_ci NULL,
    cancel_comment TEXT COLLATE latin1_swedish_ci NULL,
    order_count INT(11) DEFAULT 0 NULL,
    assigned_by_waayu INT(11) NULL,
    task_assign_count INT(11) DEFAULT 0 NULL,
    device_type VARCHAR(50) COLLATE latin1_swedish_ci NULL,
    app_version VARCHAR(50) COLLATE latin1_swedish_ci NULL,
    device_name VARCHAR(100) COLLATE latin1_swedish_ci NULL,
    device_os VARCHAR(50) COLLATE latin1_swedish_ci NULL,
  )
`;

// Execute the query to create the "tbl_order" table
async function createOrdersTable() {
  try {
    console.log("Before getting connection");
    const connection = await pool.getConnection(); // Fix here
    console.log("After getting connection");

    await connection.query(createOrdersTableQuery);
    console.log("Orders table created successfully");
  } catch (error) {
    console.error("Error creating tbl_order table:", error.message);
  } finally {
    pool.end(); // Close the connection pool
  }
}

// Run the function to create the "tbl_order" table
// createOrdersTable();
