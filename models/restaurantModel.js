const mysql = require("mysql2/promise");

// Create a connection pool
const pool = require("../db/pool");

const createRestaurantTableQuery = `
  CREATE TABLE IF NOT EXISTS rest_details (
    id INT(11) DEFAULT 'None' NOT NULL AUTO_INCREMENT,
    title TEXT COLLATE utf8_general_ci NULL,
    rimg TEXT COLLATE latin1_swedish_ci NULL,
    close_img COLLATE latin1_swedish_ci NULL,
    status INT(11) NULL,
    rate FLOAT NULL,
    dtime INT(11) NULL,
    ttime INT(11) NULL,
    atwo INT(11) NULL,
    lcode TEXT DEFAULT 'FSSAI Registration Number' COLLATE latin1_swedish_ci NULL,
    is_pure INT(11) NULL,
    is_popular INT(11) NULL,
    catid TEXT COLLATE latin1_swedish_ci NULL,
    full_address TEXT COLLATE utf8_general_ci NULL,
    pincode TEXT COLLATE latin1_swedish_ci NULL,
    city VARCHAR(50) COLLATE latin1_swedish_ci NULL,
    state VARCHAR(50) COLLATE latin1_swedish_ci NULL,
    landmark TEXT COLLATE utf8_general_ci NULL,
    lats TEXT COLLATE latin1_swedish_ci NULL,
    longs TEXT COLLATE latin1_swedish_ci NULL,
    store_charge FLOAT NULL,
    dradius INT(11) NULL,
    dcharge FLOAT NULL COMMENT 'delivery charge for fix',
    morder INT(11) NULL,
    commission FLOAT NULL,
    bank_name VARCHAR(255) COLLATE latin1_swedish_ci NULL,
    ifsc VARCHAR(70) COLLATE latin1_swedish_ci NULL,
    receipt_name VARCHAR(60) COLLATE utf8_general_ci NULL,
    acc_number VARCHAR(40) COLLATE latin1_swedish_ci NULL,
    paypal_id VARCHAR(20) COLLATE latin1_swedish_ci NULL,
    upi_id VARCHAR(20) COLLATE latin1_swedish_ci NULL,
    email TEXT COLLATE latin1_swedish_ci NULL,
    password TEXT COLLATE latin1_swedish_ci NULL,
    rstatus INT(11) DEFAULT 1 NULL,
    mobile TEXT DEFAULT 'owner Mobile number' COLLATE latin1_swedish_ci NULL,
    rest_mobile VARCHAR(15) DEFAULT 'manager mobile number' COLLATE latin1_swedish_ci NULL,
    owner_name VARCHAR(40) COLLATE latin1_swedish_ci NULL,
    sdesc TEXT COLLATE utf8_general_ci NULL,
    coupon_display INT(11) DEFAULT 0 NOT NULL,
    charge_type INT(11) NULL COMMENT '1=fixed charge, 2=dynamic charge',
    ukm INT(11) DEFAULT 0 NULL COMMENT 'base delivery distance',
    uprice INT(11) DEFAULT 0 NULL COMMENT 'dynamic base delivery charge',
    aprice INT(11) DEFAULT 0 NULL COMMENT 'dynamic extra delivery charge',
    open_time TIME DEFAULT 'None' NOT NULL,
    close_time TIME DEFAULT 'None' NOT NULL,
    opentime_evening TIME NULL,
    closetime_evening TIME NULL,
    legal_enm VARCHAR(100) COLLATE latin1_swedish_ci NULL,
    gstin VARCHAR(20) COLLATE latin1_swedish_ci NULL,
    device_id VARCHAR(255) COLLATE latin1_swedish_ci NULL,
    fcm_id VARCHAR(500) COLLATE latin1_swedish_ci NULL,
    sub_account_id VARCHAR(50) DEFAULT 0 COLLATE latin1_swedish_ci NOT NULL,
    is_ccatest INT(11) DEFAULT 0 NOT NULL COMMENT 'ccavenue testing set 1',
    unique_key VARCHAR(60) COLLATE latin1_swedish_ci NULL,
    petpooja_id VARCHAR(30) COLLATE latin1_swedish_ci NULL,
  )
`;

// Execute the query to create the "tbl_order" table
async function createRestaurantTable() {
  try {
    console.log("Before getting connection");
    const connection = await pool.getConnection(); // Fix here
    console.log("After getting connection");

    await connection.query(createRestaurantTableQuery);
    console.log("Restaurant table created successfully");
  } catch (error) {
    console.error("Error creating tbl_order table:", error.message);
  } finally {
    pool.end(); // Close the connection pool
  }
}

// Run the function to create the "tbl_order" table
// createRestaurantTable();
