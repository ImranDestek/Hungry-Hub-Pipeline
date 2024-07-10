const mysql = require("mysql2/promise");

// Create a connection pool
const pool = mysql.createPool({
  // Live Database
  host: "43.205.61.252",
  user: "masterwaayu_livusr",
  password: "A9VZIQ@S&ISl",
  database: "masterwaayu_livdb",
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,

  // Staging Database
  // host: "13.126.172.11",
  // user: "waayupro_tstusr",
  // password: "vefrrxPIDoaf",
  // database: "waayupro_tstdb",
  // waitForConnections: true,
  // connectionLimit: 10,
  // queueLimit: 0,

  // host: "localhost",
  // user: "root",
  // database: "waayupro",
  // waitForConnections: true,
  // connectionLimit: 10,
  // queueLimit: 0,
});

module.exports = pool;
