// const mysql = require("mysql2");

// function connectDb() {
//   const db = mysql.createConnection({
//     // Live Database
//     host: "43.205.61.252",
//     user: "masterwaayu_livusr",
//     password: "A9VZIQ@S&ISl",
//     database: "masterwaayu_livdb",

//     // Staging Database
//     // host: "13.126.172.11",
//     // user: "waayupro_tstusr",
//     // password: "vefrrxPIDoaf",
//     // database: "waayupro_tstdb",

//     // Local
//     // host: "localhost",
//     // user: "root",
//     // database: "waayupro",
//   });

//   db.connect((err) => {
//     if (err) {
//       console.error("Error connecting to MySQL:", err);
//       return err;
//     }
//     console.log("Connected to MySQL database");
//   });

//   return db;
// }

// module.exports = connectDb;

const mysql = require("mysql2");

function connectDb() {
  return new Promise((resolve, reject) => {
    const db = mysql.createConnection({
      host: "43.205.61.252",
      user: "masterwaayu_livusr",
      password: "A9VZIQ@S&ISl",
      database: "masterwaayu_livdb",

      // Staging
      // host: "13.126.172.11",
      // user: "waayupro_tstusr",
      // password: "vefrrxPIDoaf",
      // database: "waayupro_tstdb",
    });

    db.connect((err) => {
      if (err) {
        console.error("Error connecting to MySQL:", err);
        return reject(err);
      }
      console.log("Connected to MySQL database");
      resolve(db);
    });
  });
}

module.exports = connectDb;
