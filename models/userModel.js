const mysql = require("mysql2/promise");

// Create a connection pool
const pool = require("../db/pool");

const createUserstableQuery = `
  CREATE TABLE IF NOT EXISTS tbl_user (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name TEXT COLLATE utf8_general_ci NULL,
    mobile TEXT COLLATE latin1_swedish_ci NULL,
    password TEXT COLLATE latin1_swedish_ci NULL,
    email VARCHAR(60) COLLATE latin1_swedish_ci NULL,
    rdate DATETIME NULL,
    status INT(11) DEFAULT 1 NULL,
    ccode TEXT COLLATE latin1_swedish_ci NULL,
    code INT(11) NULL,
    refercode INT(11) NULL,
    wallet INT(11) DEFAULT 0 NULL,
    is_verify INT(11) DEFAULT 0 NULL,
    device_id VARCHAR(255) DEFAULT 'None' COLLATE latin1_swedish_ci NOT NULL,
    fcm_id VARCHAR(500) DEFAULT 'None' COLLATE latin1_swedish_ci NOT NULL,
    sms_otp INT(11) DEFAULT 0 NOT NULL,
  )
`;

// Execute the query to create the "tbl_order" table
async function createUsersTable() {
  try {
    console.log("Before getting connection");
    const connection = await pool.getConnection(); // Fix here
    console.log("After getting connection");

    await connection.query(createUserstableQuery);
    console.log("User table created successfully");
  } catch (error) {
    console.error("Error creating tbl_order table:", error.message);
  } finally {
    pool.end(); // Close the connection pool
  }
}

// Run the function to create the "tbl_order" table
// createUsersTable();
