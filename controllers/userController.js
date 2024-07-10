const pool = require("../db/pool");
const asyncHandler = require("express-async-handler");
const axios = require("axios");

// @desc Login Restaurant
// @route POST /api/user/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Please provide the email field.");
  }
  if (!password) {
    res.status(400);
    throw new Error("Please provide the password field.");
  }

  const loginQuery = `
      SELECT id, email, owner_name, rimg, password
      FROM rest_details
      WHERE email = ?
    `;

  try {
    const [user] = await pool.query(loginQuery, [email]);

    if (!user || user.length === 0) {
      res.status(401);
      throw new Error("Invalid email!");
    }

    const storedPassword = user[0].password;

    if (password !== storedPassword) {
      res.status(401);
      throw new Error("Invalid password!");
    }

    const { id, owner_name, rimg } = user[0];
    res.status(200).json({ id, email, owner_name, rimg, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// @desc Get all users
// @route GET /api/user/all
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const itemsPerPage = 25;
  const offset = (page - 1) * itemsPerPage;

  const countQuery = `
    SELECT COUNT(*) as totalUsers
    FROM tbl_user
  `;

  const userQuery = `
    SELECT id, name, mobile
    FROM tbl_user
    ORDER BY id DESC
    LIMIT ${itemsPerPage}
    OFFSET ${offset}
  `;

  const [countResult] = await pool.query(countQuery);
  const totalUsers = countResult[0].totalUsers;

  const [users] = await pool.query(userQuery);

  if (!users || users.length === 0) {
    res.status(404).json({ message: "Users not found!", success: false });
    throw new Error("Users not found.");
  }

  const userIDs = users.map((user) => user.id);

  const fetchAddressQuery = `
    SELECT id, address, lat_map, long_map, landmark, uid, city, pincode, state
    FROM tbl_address
    WHERE uid IN (?)
  `;

  const [userAddresses] = await pool.query(fetchAddressQuery, [userIDs]);

  // Merge user data with an array of addresses
  const usersWithAddresses = users.map((user) => {
    const addresses = userAddresses.filter(
      (address) => address.uid === user.id
    );
    return {
      ...user,
      addresses: addresses || [],
    };
  });

  res.status(200).json({
    users: usersWithAddresses,
    totalUsers: totalUsers,
    success: true,
  });
});

// Search Users
// GET /api/user/search?q=${query}&page=1
const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    res.status(400);
    throw new Error("Please provide the search query!");
  }

  const page = parseInt(req.query.page, 10) || 1;
  const itemsPerPage = 25;
  const offset = (page - 1) * itemsPerPage;

  const countQuery = `
    SELECT COUNT(*) as totalUsers
    FROM tbl_user
    WHERE id LIKE ? OR name LIKE ? OR mobile LIKE ?
  `;

  const userQuery = `
    SELECT id, name, mobile
    FROM tbl_user
    WHERE id LIKE ? OR name LIKE ? OR mobile LIKE ?
    ORDER BY id DESC
    LIMIT ${itemsPerPage}
    OFFSET ${offset}
  `;

  const [countResult] = await pool.query(countQuery, [
    `%${q}%`,
    `%${q}%`,
    `%${q}%`,
  ]);
  const totalUsers = countResult[0].totalUsers;

  const [users] = await pool.query(userQuery, [`%${q}%`, `%${q}%`, `%${q}%`]);

  if (!users || users.length === 0) {
    res.status(404);
    throw new Error("Users not found!");
  }

  const userIDs = users.map((user) => user.id);

  const fetchAddressQuery = `
    SELECT id, address, lat_map, long_map, landmark, uid, city, pincode, state
    FROM tbl_address
    WHERE uid IN (?)
  `;

  const [userAddresses] = await pool.query(fetchAddressQuery, [userIDs]);

  // Merge user data with an array of addresses
  const usersWithAddresses = users.map((user) => {
    const addresses = userAddresses.filter(
      (address) => address.uid === user.id
    );
    return {
      ...user,
      addresses: addresses || [],
    };
  });

  res.status(200).json({
    users: usersWithAddresses,
    totalUsers: totalUsers,
    success: true,
  });
});

// @desc Update User Details
// @route PUT /api/user/update
const updateUserDetails = asyncHandler(async (req, res) => {
  const data = req.body;

  if (!data || data.length === 0) {
    return res.status(400).json({
      message: "Invalid request format. Please provide valid data.",
      success: false,
    });
  }

  // Begin transaction
  const connection = await pool.getConnection();

  try {
    // Start transaction
    await connection.beginTransaction();

    // Loop through addresses and update each one
    for (const item of data) {
      for (const address of item.addresses) {
        const { id, city, pincode, state, uid } = address;

        // Update or insert addresses in tbl_address
        const updateAddressQuery = `
          UPDATE tbl_address
          SET city = ?, pincode = ?, state = ?
          WHERE id = ? AND uid = ?;
        `;

        await connection.query(updateAddressQuery, [
          city,
          pincode,
          state,
          id,
          uid, // uid in tbl_address
        ]);
      }
    }

    // Commit the transaction
    await connection.commit();

    res.status(200).json({
      message: "User details updated successfully.",
      success: true,
    });
  } catch (error) {
    // Rollback the transaction in case of an error
    await connection.rollback();

    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
});

//register user in waayu customer app
//@route POST /api/user/save_cust_data
const save_cust_data = asyncHandler(async (req, res) => {
  const data = req.body;
  const custName = data.custName;
  const ccode = data.ccode; // country code
  const custMobile = data.custMobile;
  const custPass = data.custPass;
  const custEmail = data.custEmail;
  const refCode = data.refCode; // referrence code
  const custDeviceid = data.custDeviceid; //device id
  const custFcmid = data.custFcmid; //FCM ID
  const custHashKey = data.custHashKey;
  //get current datetime
  const now = new Date();
  const regDate = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")} ${now
    .getHours()
    .toString()
    .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;

  const six_digit_random_number = Math.random().toString().slice(2, 8);

  if (!custMobile) {
    return res
      .status(400)
      .json({ message: "Please provide the user mobile.", success: false });
  }

  const userexistsQuery = `SELECT mobile FROM tbl_user WHERE mobile = ? `;

  const [user] = await pool.query(userexistsQuery, [custMobile]);

  if (user.length != 0) {
    return res
      .status(401)
      .json({ message: "Mobile Number Already Used", success: false });
  } else {
    const insertQuery = `
            INSERT INTO tbl_user (name, mobile, password, email, rdate, ccode, device_id, fcm_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
          `;

    const [userResult] = await pool.query(insertQuery, [
      custName,
      custMobile,
      custPass,
      custEmail,
      regDate,
      ccode,
      custDeviceid,
      custFcmid,
    ]);

    if (!userResult || userResult.affectedRows === 0) {
      return res
        .status(400)
        .json({ message: "Error while creating user.", success: false });
      // throw new Error("Error while creating user.");
    }

    // Begin transaction
    // const connection = await pool.getConnection();

    const userid = userResult.insertId;

    if (userid) {
      const updateUserDataQuery = `
            UPDATE tbl_user
            SET device_id = ?, fcm_id = ?, sms_otp = ?
            WHERE id = ?;
          `;
      await pool.query(updateUserDataQuery, [
        custDeviceid,
        custFcmid,
        six_digit_random_number,
        userid,
      ]);
    } else {
      return res
        .status(400)
        .json({ message: "Error while updating user info!", success: false });
    }

    const Phno = "91" + custMobile;
    const apiKey = "NTA3YTYxNzc0NTU0NzI2ZTc0NmE1NDY4Mzg2ZjU0NjU="; // Ensure your API key is not exposed
    const sender = "WAAYUF";
    const hashsymbol = "<#>";
    const message = `${hashsymbol} OTP to verify your mobile is : ${six_digit_random_number} ${custHashKey} thank you for using Waayu : Food Delivery & Dining. - Destek`;

    const sendSmsRes = await send_message(
      Phno,
      six_digit_random_number,
      custHashKey
    );

    if (sendSmsRes.status == "success") {
      return res
        .status(200)
        .json({ success: true, message: "User Registered successfully!" });
    } else if (sendSmsRes.status == "failure") {
      return res
        .status(400)
        .json({ message: "Error while sending otp", success: false });
    }

    // async function sendMessage(apiKey, numbers, sender, message) {
    //   const data = {
    //     apikey: apiKey,
    //     numbers: numbers,
    //     sender: sender,
    //     message: message,
    //   };

    //   // Send the POST request with axios
    //   return await axios
    //     .post("https://api.textlocal.in/send/", data)
    //     .then((response) => response.data)
    //     .catch((error) => {
    //       console.error("Error sending message:", error.message);
    //       return res
    //         .status(400)
    //         .json({ message: "Error while sending otp", error });
    //     });
    // }

    // sendMessage(apiKey, Phno, sender, message)
    //   .then((response) => {
    //     return res
    //       .status(200)
    //       .json({ success: true, message: "User registered successfully!" });
    //   })
    //   .catch((error) => {
    //     return res.status(200).json({
    //       success: true,
    //       message: "Something went wrong while sending otp",
    //       error: error,
    //     });
    //     //console.error('Failed to send message:', error);
    //   });
  }
});

// @desc Waayu Customer Login
// @route POST /api/user/verify_cust_data
const verify_cust_data = asyncHandler(async (req, res) => {
  const data = req.body;
  const custMobile = data.custMobile;
  const custPass = data.custPass;
  const custDeviceid = data.custDeviceid;
  const custFcmid = data.custFcmid;
  const custHashKey = data.custHashKey;

  if (!custMobile) {
    return res
      .status(400)
      .json({ message: "Please provide user mobile.", success: false });
  }

  const loginQuery = `
      SELECT id, name, mobile
      FROM tbl_user
      WHERE mobile = ? and status = 1 
    `;

  const [user] = await pool.query(loginQuery, [custMobile]);

  if (!user || user.length === 0) {
    return res.status(401).json({
      message: "Please provide registered mobile number.",
      success: false,
    });
  } else {
    const userid = user[0].id;
    const six_digit_random_number = Math.random().toString().slice(2, 8);

    // Begin transaction
    // const connection = await pool.getConnection();

    const updateUserDataQuery = `
          UPDATE tbl_user
          SET device_id = ?, fcm_id = ?, sms_otp = ?
          WHERE id = ?
        `;

    await pool.query(updateUserDataQuery, [
      custDeviceid,
      custFcmid,
      six_digit_random_number,
      userid,
    ]);

    const Phno = "91" + custMobile;
    const apiKey = "NTA3YTYxNzc0NTU0NzI2ZTc0NmE1NDY4Mzg2ZjU0NjU="; // Ensure your API key is not exposed
    const sender = "WAAYUF";
    const hashsymbol = "<#>";
    const message = `${hashsymbol} OTP to verify your mobile is : ${six_digit_random_number} ${custHashKey} thank you for using Waayu : Food Delivery & Dining. - Destek`;
    // console.log(message);

    const sendSmsRes = await send_message(
      Phno,
      six_digit_random_number,
      custHashKey
    );

    if (sendSmsRes.status == "success") {
      return res
        .status(200)
        .json({ success: true, message: "Otp Sent successfully!" });
    } else if (sendSmsRes.status == "failure") {
      return res
        .status(400)
        .json({ message: "Error while sending otp", success: false });
    }

    // async function sendMessage(apiKey, numbers, sender, message) {
    //   const data = {
    //     apikey: apiKey,
    //     numbers: numbers,
    //     sender: sender,
    //     message: message,
    //   };

    //   // Send the POST request with axios
    //   return await axios
    //     .post("https://api.textlocal.in/send/", data)
    //     .then((response) => response.data)
    //     .catch((error) => {
    //       console.error("Error sending message:", error.message);
    //       return res
    //         .status(400)
    //         .json({ message: "Error while sending otp", error });
    //     });
    // }

    // sendMessage(apiKey, Phno, sender, message)
    //   .then((response) => {
    //     console.log({ response });
    //     res.send(response);
    //     return res
    //       .status(200)
    //       .json({ success: true, message: "Otp Sent successfully!" });
    //   })
    //   .catch((error) => {
    //     return res.status(200).json({
    //       success: true,
    //       message: "Something went wrong",
    //       error: error,
    //     });
    //     //console.error('Failed to send message:', error);
    //   });
  }
});

// @desc Verify customer otp
// @route POST /api/user/verify_otp_data
const verify_otp_data = asyncHandler(async (req, res) => {
  const data = req.body;
  const custMobile = data.custMobile;
  const custOtp = data.custOtp;

  if (!custMobile) {
    return res
      .status(400)
      .json({ message: "Please provide user mobile.", success: false });
    //throw new Error("Please provide the email field.");
  }
  if (!custOtp) {
    return res
      .status(400)
      .json({ message: "Please provide otp.", success: false });
  }

  const loginQuery = `
      SELECT id, name, mobile, sms_otp, device_id, fcm_id
      FROM tbl_user
      WHERE mobile = ? and status = 1 
    `;

  const [user] = await pool.query(loginQuery, [custMobile]);

  if (!user || user.length === 0) {
    return res.status(401).json({
      message: "Please provide registered mobile number.",
      success: false,
    });
    //throw new Error("Invalid mobile number!");
  } else {
    const userid = user[0].id;
    const existotp = user[0].sms_otp;

    if (existotp == custOtp) {
      return res.status(200).send(user[0]);
    } else {
      return res.status(401).json({ message: "Incorrect OTP", success: false });
    }
  }
});

async function send_message(numbers, otp, hashkey) {
  const formData = new FormData();

  formData.append("mobile", numbers);
  formData.append("otp", otp);
  formData.append("hashkey", hashkey);

  const response = await axios.post(
    "https://master.waayu.app/otp_sender/send_message.php",
    formData
  );

  const result = response.data;
  return result;
}

const get_cust_data = asyncHandler(async (req, res) => {
  const data = req.body;
  const mobile = data.mobile;

  if (!mobile) {
    return res
      .status(400)
      .json({ message: "Please provide customer mobile.", success: false });
  }

  const query = `
    SELECT id, name, mobile, email, image, birth_date, special_date	
    FROM tbl_user
    WHERE mobile = ?
  `;

  const [user] = await pool.query(query, [mobile]);

  if (!user || user.length === 0) {
    return res.status(404).json({
      message: "User not found!",
      success: false,
    });
  }

  const formattedUser = {
    id: user[0].id,
    name: user[0].name,
    mobile: user[0].mobile,
    email: user[0].email,
    image: `/images/user/${user[0].image}`,
    birth_date: new Date(user[0].birth_date).toLocaleDateString(),
    special_date: new Date(user[0].special_date).toLocaleDateString(),
  };

  res.status(200).send(formattedUser);
});

const update_cust_data = asyncHandler(async (req, res) => {
  const { mobile, name, email, birth_date, special_date } = req.body;

  let image = "";

  if (!mobile) {
    return res
      .status(400)
      .json({ message: "Please provide customer mobile.", success: false });
  }

  if (req.file) {
    const fileName = req.file.filename;
    const filenameWithoutSpaces = fileName.replace(/\s+/g, "");
    image = filenameWithoutSpaces;
  }

  let query = `UPDATE tbl_user SET`;
  const values = [];
  const updateFields = [];

  if (name) {
    updateFields.push("name = ?");
    values.push(name);
  }
  if (email) {
    updateFields.push("email = ?");
    values.push(email);
  }
  if (mobile) {
    updateFields.push("mobile = ?");
    values.push(mobile);
  }
  if (image) {
    updateFields.push("image = ?");
    values.push(image);
  }
  if (birth_date) {
    updateFields.push("birth_date = ?");
    values.push(birth_date);
  }
  if (special_date) {
    updateFields.push("special_date = ?");
    values.push(special_date);
  }

  if (updateFields.length === 0) {
    return res
      .status(400)
      .json({ message: "No data provided for update", success: false });
  }

  // Constructing the final query
  query += ` ${updateFields.join(", ")} WHERE mobile = ?`;
  values.push(mobile);

  await pool.query(query, values);

  const updatedUserQuery =
    "SELECT id, name, mobile, email, image, birth_date, special_date FROM tbl_user WHERE mobile = ?";
  const [updatedUser] = await pool.query(updatedUserQuery, [mobile]);

  const formattedUser = {
    id: updatedUser[0].id,
    name: updatedUser[0].name,
    mobile: updatedUser[0].mobile,
    email: updatedUser[0].email,
    image: `/images/user/${updatedUser[0].image}`,
    birth_date: new Date(updatedUser[0].birth_date).toLocaleDateString(),
    special_date: new Date(updatedUser[0].special_date).toLocaleDateString(),
  };

  return res.status(200).json({
    ...formattedUser,
    message: "User updated successfully.",
    success: true,
  });
});

const add_cust_address = asyncHandler(async (req, res) => {
  let {
    uid,
    address,
    houseno,
    landmark,
    type,
    city,
    lat_map,
    long_map,
    pincode,
    state,
    country,
    is_primary,
    device_type,
    app_version,
    device_name,
    device_os,
  } = req.body;

  if (!uid) {
    return res
      .status(400)
      .json({ message: "Please provide customer id.", success: false });
  }

  if (!country) {
    country = "";
  }
  if (!device_type) {
    device_type = null;
  }
  if (!app_version) {
    app_version = null;
  }
  if (!device_name) {
    device_name = null;
  }
  if (!device_os) {
    device_os = null;
  }

  const currentDate = new Date();

  const formattedDate = currentDate
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  console.log(formattedDate);

  const query = `
  INSERT INTO tbl_address (uid,
    address,
    houseno,
    landmark,
    type,
    pincode,
    city,
    lat_map,
    long_map,
    state,
    country,
    is_primary,
    device_type,
    app_version,
    device_name,
    device_os,
    date_time)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,?)
  `;

  const [result] = await pool.query(query, [
    uid,
    address,
    houseno,
    landmark,
    type,
    pincode,
    city,
    lat_map,
    long_map,
    state,
    country,
    is_primary,
    device_type,
    app_version,
    device_name,
    device_os,
    formattedDate,
  ]);

  if (!result || result.length === 0) {
    return res
      .status(404)
      .json({ message: "Error while adding address!", success: false });
  }

  res
    .status(200)
    .json({ message: "Address added Successfully", success: true });
});

const get_cust_address = asyncHandler(async (req, res) => {
  const { uid } = req.body;

  const query = `
  SELECT id, uid, address, houseno, landmark, type, pincode, city, state, lat_map, long_map, is_primary FROM tbl_address WHERE uid = ? and status = '1'
  `;

  const [result] = await pool.query(query, [uid]);

  if (!result || result.length === 0) {
    return res
      .status(404)
      .json({ message: "Address not found!", success: false });
  }

  res.status(200).send(result);
});

const update_cust_address = asyncHandler(async (req, res) => {
  let {
    id,
    uid,
    address,
    houseno,
    landmark,
    type,
    pincode,
    city,
    state,
    lat_map,
    long_map,
    is_primary,
  } = req.body;

  if (!id) {
    return res
      .status(400)
      .json({ message: "Please provide address id.", success: false });
  }
  if (!uid) {
    return res
      .status(400)
      .json({ message: "Please provide uid.", success: false });
  }
  if (!address) {
    return res
      .status(400)
      .json({ message: "Please provide address field.", success: false });
  }
  if (!houseno) {
    return res
      .status(400)
      .json({ message: "Please provide houseno.", success: false });
  }
  if (!landmark) {
    return res
      .status(400)
      .json({ message: "Please provide landmark.", success: false });
  }
  if (!type) {
    return res
      .status(400)
      .json({ message: "Please provide address type.", success: false });
  }
  if (!pincode) {
    return res
      .status(400)
      .json({ message: "Please provide pincode.", success: false });
  }
  if (!city) {
    return res
      .status(400)
      .json({ message: "Please provide city.", success: false });
  }
  if (!state) {
    return res
      .status(400)
      .json({ message: "Please provide state.", success: false });
  }
  if (!lat_map) {
    return res
      .status(400)
      .json({ message: "Please provide lat_map.", success: false });
  }
  if (!long_map) {
    return res
      .status(400)
      .json({ message: "Please provide long_map.", success: false });
  }
  if (!is_primary) {
    return res
      .status(400)
      .json({ message: "Please provide is_primary.", success: false });
  }

  // need uid also
  if (is_primary == 1) {
    const resetPrimaryQuery = `
    UPDATE tbl_address
    SET is_primary = 0
    WHERE uid = ? AND id != ?
  `;

    await pool.query(resetPrimaryQuery, [uid, id]);
  }

  const query = `
  UPDATE tbl_address
  SET address = ?, houseno = ?, landmark = ?, type = ?, pincode = ?, city = ?, state = ?, lat_map = ?, long_map = ?, is_primary = ?
  WHERE id = ? AND uid = ?
  `;

  const [result] = await pool.query(query, [
    address,
    houseno,
    landmark,
    type,
    pincode,
    city,
    state,
    lat_map,
    long_map,
    is_primary,
    id,
    uid,
  ]);

  if (!result || result.length === 0) {
    return res
      .status(404)
      .json({ message: "Error while updating address!", success: false });
  }

  res
    .status(200)
    .json({ message: "Address updated Successfully", success: true });
});

const delete_cust_address = asyncHandler(async (req, res) => {
  const { addid, uid } = req.body;

  const query = `UPDATE tbl_address SET status = '0' WHERE id = ? and uid = ?`;

  const [result] = await pool.query(query, [addid, uid]);

  if (!result || result.length === 0) {
    return res
      .status(404)
      .json({ message: "Error while deleting address!", success: false });
  }

  res
    .status(200)
    .json({ message: "Address deleted successfully!", success: true });
});

module.exports = {
  login,
  getAllUsers,
  searchUsers,
  updateUserDetails,
  save_cust_data,
  verify_cust_data,
  verify_otp_data,
  get_cust_data,
  add_cust_address,
  update_cust_data,
  get_cust_address,
  update_cust_address,
  delete_cust_address,
};
