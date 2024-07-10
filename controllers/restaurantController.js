const pool = require("../db/pool");
const asyncHandler = require("express-async-handler");
const fs = require("fs");
const moment = require("moment-timezone");
const PDFDocument = require("pdfkit");
const { ToWords } = require("to-words");
const axios = require("axios");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
const serviceAccountAndroid = require("../hungryfood-b12d5-firebase-adminsdk-bgu44-a98f2b46e4.json");
const serviceAccountFlutter = require("../hungryhub-7e94c-101b2623c08d.json");
const serviceAccountOwner = require("../waayu-owner-firebase-adminsdk-axhxc-6b01b1c84b.json");
const serviceAccountOwnerIOS = require("../waayu-owner-firebase-adminsdk-axhxc-0585fdf3a1.json");

const adminAndroid = admin.initializeApp(
  {
    credential: admin.credential.cert(serviceAccountAndroid),
  },
  "androidApp"
);

// Initialize the second Firebase project
const adminFlutter = admin.initializeApp(
  {
    credential: admin.credential.cert(serviceAccountFlutter),
  },
  "flutterApp"
);

const adminOwner = admin.initializeApp(
  {
    credential: admin.credential.cert(serviceAccountOwner),
  },
  "ownerApp"
);

const adminOwnerIOS = admin.initializeApp(
  {
    credential: admin.credential.cert(serviceAccountOwnerIOS),
  },
  "ownerAppIOS"
);

function getCurrentFormattedDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const getBannerList = asyncHandler(async (req, res) => {
  const bannerQuery = `
      SELECT id, img, rid, status
      FROM tbl_banner WHERE status = 1
      ORDER BY id DESC
    `;

  const [banners] = await pool.query(bannerQuery);

  if (!banners || banners.length === 0) {
    return res
      .status(404)
      .json({ message: "Banners not found!", success: false });
  }

  const data = banners.map((banner) => {
    return {
      id: banner.id,
      banner_img: banner.img,
      rest_id: banner.rid,
      status: banner.status,
      token: "",
    };
  });

  res.status(200).send(data);
});

const getPopularRestaurant = asyncHandler(async (req, res) => {
  const data = req.body;
  const custId = data.custId;
  const custLats = data.custLats;
  const custLongs = data.custLongs;

  if (!custLats) {
    return res
      .status(400)
      .json({ message: "Please provide user latitude.", success: false });
  }

  if (!custLongs) {
    return res
      .status(400)
      .json({ message: "Please provide user longitude.", success: false });
  }
  if (!custId) {
    return res
      .status(400)
      .json({ message: "Please provide custId.", success: false });
  }

  const distanceQuery = `
    SELECT 
        (((acos(sin((${custLats}*pi()/180))*sin((lats*pi()/180))+cos((${custLats}*pi()/180))*cos((lats*pi()/180))*cos(((${custLongs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
        id, 
        title,
        rstatus,
        rate,
        atwo, 
        full_address,
        mobile,
        dradius,
        status,
        open_time,
        close_time,
        opentime_evening,
        closetime_evening,
        CASE 
            WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
            ELSE close_img
        END AS image,
        catid, 
        is_pure
    FROM rest_details 
    WHERE status = 1 AND is_popular = 1
    HAVING distance <= 30 
    ORDER BY priority, distance
`;

  const [restlist] = await pool.query(distanceQuery);

  if (!restlist || restlist.length === 0) {
    return res.status(404).json({
      message: "Restaurant not found in your locations!",
      success: false,
    });
  }

  const promises = restlist.map(async (element) => {
    const catid = element.catid;

    if (catid) {
      const catids = catid.split(",");

      let catnm = "";
      await Promise.all(
        catids.map(async (newid) => {
          const categoryQuery = `SELECT * FROM tbl_category WHERE id = ? `;
          const [result] = await pool.query(categoryQuery, [newid]);

          const cate_name = result[0].cat_name;

          if (cate_name) {
            catnm += cate_name + ",";
          }
        })
      );

      // Remove the trailing comma
      catnm = catnm.replace(/,$/, "");

      // Update the element with the concatenated category names
      element.catname = catnm;

      // if (element.rstatus == 1 && element.status == 1) {
      //   element.is_servicable = "1";
      // } else {
      //   element.is_servicable = "0";
      // }

      setServiceability(element);

      if (element.distance > element.dradius) {
        element.is_servicable = 0;
      }

      const isFavorited = await checkFavorite(custId, element.id);
      element.isFavorite = isFavorited;
    }
  });

  // Wait for all promises to resolve
  await Promise.all(promises);

  const resData = restlist.map((item) => {
    return {
      rest_id: item.id,
      rest_name: item.title,
      rest_mobile: item.mobile,
      rest_img: item.image,
      cat_name: item.catname,
      is_favourite: item.isFavorite,
      rest_rating: item.rate,
      delivery_time: "25-30min",
      distance: item.distance.toFixed(2) + " Kms",
      rest_costfortwo: item.atwo,
      is_veg: item.is_pure,
      rest_full_address: item.full_address,
      is_servicable: item.is_servicable,
      token: "",
    };
  });

  res.status(200).send(resData);
});

const checkFavorite = async (uid, rest_id) => {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM tbl_fav WHERE uid = ? AND rest_id = ?",
      [uid, rest_id]
    );
    return rows.length > 0 ? 1 : 0; // Return true if the favorite exists, false otherwise
  } catch (error) {
    throw error;
  }
};

const getCravingData = asyncHandler(async (req, res) => {
  const query = `
  SELECT id, cat_name, cat_img 
  FROM tbl_category 
  WHERE cat_status = 1 AND is_show_home = 1 
  ORDER BY sequence
  `;

  const [result] = await pool.query(query);

  if (!result || result.length === 0) {
    return res.status(404).json({
      message: "Category not found!",
      success: false,
    });
  }

  const data = result.map((item) => {
    return {
      id: item.id,
      cat_name: item.cat_name,
      cat_img: item.cat_img,
      token: "",
    };
  });

  res.status(200).send(data);
});

const getRestaurantListAgainstCategory = asyncHandler(async (req, res) => {
  const { catId, custLats, custLongs } = req.body;

  if (!catId) {
    return res.status(400).json({
      message: "Please provide category id",
      success: false,
    });
  }
  if (!custLats) {
    return res.status(400).json({
      message: "Please provide customer latitude",
      success: false,
    });
  }
  if (!custLongs) {
    return res.status(400).json({
      message: "Please provide customer longitude",
      success: false,
    });
  }

  const query = `
  SELECT 
  id,
  title,
  (((acos(sin((${custLats}*pi()/180)) * sin((lats*pi()/180))+cos((${custLats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${custLongs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
  CASE 
      WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
      ELSE close_img
  END AS image,
  rate, 
  dtime, 
  atwo,
  dradius,
  full_address, 
  is_pure,
  mobile,
  catid,
  open_time,
  close_time,
  opentime_evening,
  closetime_evening
FROM 
  rest_details 
WHERE 
  status = 1 AND catid IN(${catId}) AND rstatus = 1
HAVING 
  distance <= 30 
ORDER BY 
  rate DESC
`;

  const [result] = await pool.query(query);

  if (!result || result.length === 0) {
    return res.status(404).json({
      message: "Restaurant not found!",
      success: false,
    });
  }

  const promises = result.map(async (element) => {
    const catid = element.catid;

    if (catid) {
      const catids = catid.split(",");

      let catnm = "";
      await Promise.all(
        catids.map(async (newid) => {
          const categoryQuery = `SELECT * FROM tbl_category WHERE id = ? `;
          const [result] = await pool.query(categoryQuery, [newid]);

          const cate_name = result[0].cat_name;

          if (cate_name) {
            catnm += cate_name + ",";
          }
        })
      );

      // Remove the trailing comma
      catnm = catnm.replace(/,$/, "");

      // Update the element with the concatenated category names
      element.catname = catnm;

      // if (element.rstatus == 1 && element.status == 1) {
      //   element.is_servicable = "1";
      // } else {
      //   element.is_servicable = "0";
      // }

      setServiceability(element);

      if (element.distance > element.dradius) {
        element.is_servicable = 0;
      }
    }
  });

  // Wait for all promises to resolve
  await Promise.all(promises);

  const resData = result.map((item) => {
    return {
      rest_id: item.id,
      rest_name: item.title,
      rest_mobile: item.mobile,
      rest_img: item.image,
      cat_name: item.catname,
      is_favourite: item.isFavorite,
      rest_rating: item.rate,
      delivery_time: "25-30min",
      distance: item.distance.toFixed(2) + " Kms",
      rest_costfortwo: item.atwo,
      is_veg: item.is_pure,
      rest_full_address: item.full_address,
      is_servicable: item.is_servicable,
      token: "",
    };
  });

  res.status(200).send(resData);
});

const getCurrentTime = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 100 + minutes; // Convert time to HHMM format
  return currentTime;
};

// const convertTimeToHHMM = (timeString) => {
//   const [hours, minutes, seconds] = timeString.split(":").map(Number);
//   return hours * 100 + minutes + seconds; // Convert time to HHMM format
// };

const convertTimeToHHMMSS = (timeString) => {
  return moment(timeString, "HH:mm:ss").format("HH:mm:ss");
};

const setServiceability = (element) => {
  // Set the timezone to Asia/Kolkata
  const currentTime = moment().tz("Asia/Kolkata");

  // Morning slot
  const morningOpenTime = moment.tz(
    convertTimeToHHMMSS(element.open_time),
    "HH:mm:ss",
    "Asia/Kolkata"
  );
  const morningCloseTime = moment.tz(
    convertTimeToHHMMSS(element.close_time),
    "HH:mm:ss",
    "Asia/Kolkata"
  );
  const isMorningServicable = currentTime.isBetween(
    morningOpenTime,
    morningCloseTime,
    null,
    "[)"
  )
    ? 1
    : 0;

  // Evening slot
  let isEveningServicable = 0;
  if (element.opentime_evening !== null && element.closetime_evening !== null) {
    const eveningOpenTime = moment.tz(
      convertTimeToHHMMSS(element.opentime_evening),
      "HH:mm:ss",
      "Asia/Kolkata"
    );
    let eveningCloseTime = moment.tz(
      convertTimeToHHMMSS(element.closetime_evening),
      "HH:mm:ss",
      "Asia/Kolkata"
    );

    // Adjust eveningCloseTime if it's before eveningOpenTime to consider it on the next day
    if (eveningCloseTime.isBefore(eveningOpenTime)) {
      eveningCloseTime.add(1, "days");
    }

    // Check if current time is between evening opening and closing times
    isEveningServicable = currentTime.isBetween(
      eveningOpenTime,
      eveningCloseTime,
      null,
      "[)"
    )
      ? 1
      : 0;
  }

  element.is_servicable = isMorningServicable || isEveningServicable;
};

// const setServiceability = (element) => {
//   const currentTime = getCurrentTime();

//   // Morning slot
//   const morningOpenTime = convertTimeToHHMM(element.open_time);
//   const morningCloseTime = convertTimeToHHMM(element.close_time);
//   const isMorningServicable =
//     currentTime >= morningOpenTime && currentTime < morningCloseTime ? 1 : 0;

//   // Evening slot
//   let isEveningServicable = 0;
//   if (element.opentime_evening !== null && element.closetime_evening !== null) {
//     const eveningOpenTime = convertTimeToHHMM(element.opentime_evening);
//     let eveningCloseTime = convertTimeToHHMM(element.closetime_evening);

//     // Adjust eveningCloseTime if it's before eveningOpenTime to consider it on the next day
//     if (eveningCloseTime < eveningOpenTime) {
//       eveningCloseTime += 2400; // Add 24 hours (2400 minutes) to make it on the next day
//     }

//     // Check if current time is between evening opening and closing times
//     isEveningServicable =
//       currentTime >= eveningOpenTime && currentTime < eveningCloseTime ? 1 : 0;
//   }

//   element.is_servicable = isMorningServicable || isEveningServicable;
// };

// Get Restaurants Near You
const getRestaurantNearYou = asyncHandler(async (req, res) => {
  let { lats, longs, sortBy, offset, custId } = req.body;

  if (!lats) {
    return res
      .status(400)
      .json({ message: "Please provide the lats field.", success: false });
  }
  if (!longs) {
    return res
      .status(400)
      .json({ message: "Please provide the longs field.", success: false });
  }
  // if (!custId) {
  //   return res
  //     .status(400)
  //     .json({ message: "Please provide the custId.", success: false });
  // }

  if (!offset) {
    offset = 0;
  }
  // console.log(offset);

  let skip = (parseInt(offset) + 1 - 1) * 10;

  // console.log(skip);

  let distanceQuery;

  if (sortBy == 1) {
    console.log(1);
    distanceQuery = `
    SELECT 
      id,
      title,
      (((acos(sin((${lats}*pi()/180)) * sin((lats*pi()/180))+cos((${lats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${longs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
      CASE 
          WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
          ELSE close_img
      END AS image,
      rate, 
      dtime, 
      atwo,
      dradius,
      full_address, 
      is_pure,
      mobile,
      catid,
      open_time,
      close_time,
      opentime_evening,
      closetime_evening
    FROM 
      rest_details 
    WHERE 
      status = 1 AND rstatus = 1 
    HAVING 
      distance <= 30 
    ORDER BY 
      rate DESC
      LIMIT 
      10 OFFSET ${skip}`;
  } else if (sortBy == 2) {
    console.log(2);
    distanceQuery = `
    SELECT 
      id,
      title,
      (((acos(sin((${lats}*pi()/180)) * sin((lats*pi()/180))+cos((${lats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${longs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
      CASE 
          WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
          ELSE close_img
      END AS image,
      rate, 
      dtime, 
      atwo,
      dradius,
      full_address, 
      is_pure,
      mobile,
      catid,
      open_time,
      close_time,
      opentime_evening,
      closetime_evening
    FROM 
      rest_details 
    WHERE 
      status = 1 AND rstatus = 1 
    HAVING 
      distance <= 30 
    ORDER BY 
      dtime ASC
      LIMIT 
      10 OFFSET ${skip}`;
  } else if (sortBy == 3) {
    console.log(3);
    distanceQuery = `
    SELECT 
      id,
      title,
      (((acos(sin((${lats}*pi()/180)) * sin((lats*pi()/180))+cos((${lats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${longs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
      CASE 
          WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
          ELSE close_img
      END AS image,
      rate, 
      dtime, 
      atwo,
      dradius,
      full_address, 
      is_pure,
      mobile,
      catid,
      open_time,
      close_time,
      opentime_evening,
      closetime_evening
    FROM 
      rest_details 
    WHERE 
      status = 1 AND rstatus = 1 
    HAVING 
      distance <= 30 
    ORDER BY 
      atwo ASC
      LIMIT 
      10 OFFSET ${skip}`;
  } else if (sortBy == 4) {
    console.log(4);
    distanceQuery = `
    SELECT 
      id,
      title,
      (((acos(sin((${lats}*pi()/180)) * sin((lats*pi()/180))+cos((${lats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${longs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
      CASE 
          WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
          ELSE close_img
      END AS image,
      rate, 
      dtime, 
      atwo,
      dradius,
      full_address, 
      is_pure,
      mobile,
      catid,
      open_time,
      close_time,
      opentime_evening,
      closetime_evening
    FROM 
      rest_details 
    WHERE 
      status = 1 AND rstatus = 1 
    HAVING 
      distance <= 30 
    ORDER BY 
      atwo DESC
      LIMIT 
      10 OFFSET ${skip}`;
  } else if (sortBy == 6) {
    console.log(6);
    distanceQuery = `
    SELECT 
      id,
      title,
      (((acos(sin((${lats}*pi()/180)) * sin((lats*pi()/180))+cos((${lats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${longs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
      CASE 
          WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
          ELSE close_img
      END AS image,
      rate, 
      dtime, 
      atwo,
      dradius,
      full_address, 
      is_pure,
      mobile,
      catid,
      open_time,
      close_time,
      opentime_evening,
      closetime_evening
    FROM 
      rest_details 
    WHERE 
      status = 1 AND rstatus = 1 
    HAVING 
      distance <= 30 
    ORDER BY 
      distance ASC
      LIMIT 
      10 OFFSET ${skip}`;
  } else {
    distanceQuery = `
    SELECT 
      id,
      title,
      (((acos(sin((${lats}*pi()/180)) * sin((lats*pi()/180))+cos((${lats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${longs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
      CASE 
          WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
          ELSE close_img
      END AS image,
      rate, 
      dtime, 
      atwo,
      dradius,
      full_address, 
      is_pure,
      mobile,
      catid,
      open_time,
      close_time,
      opentime_evening,
      closetime_evening
    FROM 
      rest_details 
    WHERE 
      status = 1 AND rstatus = 1 
    HAVING 
      distance <= 30 
    ORDER BY 
      rate DESC, distance ASC
      LIMIT 
      10 OFFSET ${skip}`;
  }

  // console.log(distanceQuery);
  const [restlist] = await pool.query(distanceQuery);

  if (!restlist || restlist.length === 0) {
    return res.status(404).json({
      message: "Restaurant not found in your locations!",
      success: false,
    });
  }

  const promises = restlist.map(async (element) => {
    const catid = element.catid;

    if (catid) {
      const catids = catid.split(",");

      let catnm = "";
      await Promise.all(
        catids.map(async (newid) => {
          const categoryQuery = `SELECT * FROM tbl_category WHERE id = ? `;
          const [result] = await pool.query(categoryQuery, [newid]);

          const cate_name = result[0].cat_name;

          if (cate_name) {
            catnm += cate_name + ",";
          }
        })
      );

      // Remove the trailing comma
      catnm = catnm.replace(/,$/, "");

      // Update the element with the concatenated category names
      element.catname = catnm;

      // if (element.rstatus == 1 && element.status == 1) {
      //   element.is_servicable = "1";
      // } else {
      //   element.is_servicable = "0";
      // }

      setServiceability(element);

      if (element.distance > element.dradius) {
        element.is_servicable = 0;
      }

      if (custId && custId !== "") {
        const isFavorited = await checkFavorite(custId, element.id);
        element.isFavorite = isFavorited;
      }
    }
  });

  // Wait for all promises to resolve
  await Promise.all(promises);
  let data;
  if (custId) {
    data = restlist.map((item) => {
      return {
        rest_id: item.id,
        rest_name: item.title,
        rest_mobile: item.mobile,
        rest_img: item.image,
        cat_name: item.catname,
        is_favourite: item.isFavorite,
        rest_rating: item.rate,
        delivery_time: item.dtime + " mins",
        distance: item.distance.toFixed(2) + " Kms",
        rest_costfortwo: item.atwo,
        is_veg: item.is_pure,
        rest_full_address: item.full_address,
        is_servicable: item.is_servicable,
        token: "",
      };
    });
  } else {
    data = restlist.map((item) => {
      return {
        rest_id: item.id,
        rest_name: item.title,
        rest_mobile: item.mobile,
        rest_img: item.image,
        cat_name: item.catname,
        rest_rating: item.rate,
        delivery_time: item.dtime + " mins",
        distance: item.distance.toFixed(2) + " Kms",
        rest_costfortwo: item.atwo,
        is_veg: item.is_pure,
        rest_full_address: item.full_address,
        is_servicable: item.is_servicable,
        token: "",
      };
    });
  }

  res.status(200).send(data);
});

// Search Nearby Restaurants
const searchRestaurants = asyncHandler(async (req, res) => {
  let { lats, longs, search, offset } = req.body;

  if (!lats) {
    return res
      .status(400)
      .json({ message: "Please provide the lats field", success: false });
  }
  if (!longs) {
    return res
      .status(400)
      .json({ message: "Please provide the longs field", success: false });
  }
  if (!search) {
    return res
      .status(400)
      .json({ message: "Please provide the search field", success: false });
  }

  if (!offset) {
    offset = 0;
  }

  const searchKeyword = `%${search}%`;

  const distanceQuery = `
  SELECT 
    id,
    title,
    (((acos(sin((${lats}*pi()/180)) * sin((lats*pi()/180))+cos((${lats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${longs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance, 
    CASE 
        WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
        ELSE close_img
    END AS image,
    rate, 
    dtime, 
    atwo,
    dradius,
    full_address, 
    is_pure,
    mobile,
    catid,
    open_time,
    close_time,
    opentime_evening,
    closetime_evening
  FROM 
    rest_details 
  WHERE 
    status = 1 AND rstatus = 1
    AND title LIKE ?
  HAVING 
    distance <= 30 
  ORDER BY 
    rate DESC, distance ASC
  LIMIT 
    ${offset}, 10`;

  const [restlist] = await pool.query(distanceQuery, [searchKeyword]);

  if (!restlist || restlist.length === 0) {
    return res.status(404).json({
      message: "Restaurant not found in your locations!",
      success: false,
    });
  }

  const promises = restlist.map(async (element) => {
    const catid = element.catid;

    if (catid) {
      const catids = catid.split(",");

      let catnm = "";
      await Promise.all(
        catids.map(async (newid) => {
          const categoryQuery = `SELECT * FROM tbl_category WHERE id = ? `;
          const [result] = await pool.query(categoryQuery, [newid]);

          const cate_name = result[0].cat_name;

          if (cate_name) {
            catnm += cate_name + ",";
          }
        })
      );

      // Remove the trailing comma
      catnm = catnm.replace(/,$/, "");

      // Update the element with the concatenated category names
      element.catname = catnm;

      // if (element.rstatus == 1 && element.status == 1) {
      //   element.is_servicable = "1";
      // } else {
      //   element.is_servicable = "0";
      // }

      setServiceability(element);

      if (element.distance > element.dradius) {
        element.is_servicable = 0;
      }
    }
  });

  // Wait for all promises to resolve
  await Promise.all(promises);

  const data = restlist.map((item) => {
    return {
      rest_id: item.id,
      rest_name: item.title,
      rest_mobile: item.mobile,
      rest_img: item.image,
      cat_name: item.catname,
      is_favourite: 0,
      rest_rating: item.rate,
      delivery_time: item.dtime + " mins",
      distance: item.distance.toFixed(2) + " Kms",
      rest_costfortwo: item.atwo,
      is_veg: item.is_pure,
      rest_full_address: item.full_address,
      is_servicable: item.is_servicable,
      token: "",
    };
  });

  res.status(200).send(data);
});

const getRestaurantItemsAndCat = asyncHandler(async (req, res) => {
  const { rid } = req.body;

  if (!rid) {
    return res.status(400).json({ message: "Please provide restaurant id" });
  }

  const query = `
        SELECT rc.id, rc.title, mi.id AS menu_id, mi.title AS menu_item, mi.gst, mi.cdesc, mi.price, mi.discount_price, mi.item_img, mi.is_variations, mi.is_egg, mi.is_veg, mi.is_customize, mi.is_variations, mi.customize_times, mi.is_customize_time
        FROM rest_cat rc
        JOIN menu_item mi ON rc.id = mi.menuid
        WHERE rc.rid = ? AND mi.status = 1
        ORDER BY rc.id, mi.id
      `;

  const [items] = await pool.query(query, [rid]);

  if (!items || items.length === 0) {
    return res.status(404).json({ message: "No items found!", success: false });
  }

  // Initialize categoryData object
  const categoryData = {};

  // Iterate over items
  items.forEach((result) => {
    const categoryId = result.id;

    // If category not added to the object, add it
    if (!categoryData[categoryId]) {
      categoryData[categoryId] = {
        id: categoryId,
        title: result.title,
        menuitem_data: [],
      };
    }

    // Check if image file exists
    const imagePath = `/images/mitem/${result.item_img}`;
    let itemImage = null;

    if (fs.existsSync(imagePath)) {
      itemImage = imagePath;
    }

    // Add product to the category
    categoryData[categoryId].menuitem_data.push({
      id: result.menu_id,
      title: result.menu_item,
      gst: result.gst,
      item_img: itemImage,
      price: result.price,
      s_price: result.discount_price,
      disc_perc: String(
        Math.round(
          ((result.discount_price - result.price) / result.discount_price) * 100
        )
      ),
      is_veg: result.is_veg,
      is_customize: result.is_customize,
      is_variations: result.is_variations,
      cdesc: result.cdesc,
      max_qty: "1",
    });
  });

  // Filter out categories without menuitem_data
  const filteredCategoryData = Object.values(categoryData).filter(
    (category) => category.menuitem_data.length > 0
  );

  res.status(200).send(filteredCategoryData);
});

const getRestaurantItemsAndCatFlutter = asyncHandler(async (req, res) => {
  const { rid } = req.body;

  if (!rid) {
    return res.status(400).json({ message: "Please provide restaurant id" });
  }

  const query = `
    SELECT rc.id, rc.title, mi.id AS menu_id, mi.title AS menu_item, mi.gst, mi.cdesc, mi.price, mi.discount_price, mi.item_img, mi.is_variations, mi.is_egg, mi.is_veg, mi.is_customize, mi.is_variations, mi.customize_times, mi.is_customize_time 
    FROM rest_cat rc 
    JOIN menu_item mi ON rc.id = mi.menuid 
    WHERE rc.rid = ? AND mi.status = 1
    ORDER BY rc.id, mi.id
  `;

  const [items] = await pool.query(query, [rid]);

  if (!items || items.length === 0) {
    return res.status(404).json({ message: "No items found!", success: false });
  }

  // Initialize categoryData object
  const categoryData = {};

  // Iterate over items
  for (const result of items) {
    const categoryId = result.id;

    // If category not added to the object, add it
    if (!categoryData[categoryId]) {
      categoryData[categoryId] = {
        id: categoryId,
        title: result.title,
        menuitem_data: [],
      };
    }

    // Check if image file exists
    const imagePath = `/images/mitem/${result.item_img}`;
    let itemImage = null;

    if (fs.existsSync(imagePath)) {
      itemImage = imagePath;
    }

    // Initialize the menu item object
    const menuItem = {
      id: result.menu_id,
      title: result.menu_item,
      gst: result.gst,
      item_img: itemImage,
      price: result.price,
      s_price: result.discount_price,
      disc_perc: String(
        Math.round(
          ((result.discount_price - result.price) / result.discount_price) * 100
        )
      ),
      is_veg: result.is_veg,
      is_customize: result.is_customize,
      is_variations: result.is_variations,
      cdesc: result.cdesc,
      max_qty: "1",
      addon_variations: [],
    };

    // Fetch addon variations if they exist
    if (result.is_variations == 1) {
      console.log("YES");
      const addonQuery = `
        SELECT id, title, price, discount_price 
        FROM addon_variations 
        WHERE status = 1 AND items_id = ?
      `;

      const [addonVariationData] = await pool.query(addonQuery, [
        result.menu_id,
      ]);

      console.log(addonVariationData);

      if (addonVariationData && addonVariationData.length > 0) {
        addonVariationData.forEach((elem) => {
          menuItem.addon_variations.push({
            addon_id: elem.id,
            addon_title: elem.title,
            addon_discount_price: elem.discount_price,
            addon_price: elem.price,
          });
        });
      }
    }

    // Add the menu item to the category
    categoryData[categoryId].menuitem_data.push(menuItem);
  }

  // Filter out categories without menuitem_data
  const filteredCategoryData = Object.values(categoryData).filter(
    (category) => category.menuitem_data.length > 0
  );

  res.status(200).send(filteredCategoryData);
});

const getRestaurantItemsAndCatNew = asyncHandler(async (req, res) => {
  const { rid, custLats, custLongs, custId } = req.body;

  if (!rid) {
    return res.status(400).json({ message: "Please provide restaurant id" });
  }

  const query = `
        SELECT rc.id, rc.title, mi.id AS menu_id, mi.title AS menu_item, mi.gst, mi.cdesc, mi.price, mi.discount_price, mi.item_img, mi.is_variations, mi.is_egg, mi.is_veg, mi.is_customize, mi.is_variations, mi.customize_times, mi.is_customize_time 
        FROM rest_cat rc 
        JOIN menu_item mi ON rc.id = mi.menuid 
        WHERE rc.rid = ? AND mi.status = 1
        ORDER BY rc.id, mi.id
      `;

  const [items] = await pool.query(query, [rid]);

  if (!items || items.length === 0) {
    return res.status(404).json({ message: "No items found!", success: false });
  }

  const rQuery = `
      SELECT
      id,
      title,
      (((acos(sin((${custLats}*pi()/180)) * sin((lats*pi()/180))+cos((${custLats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${custLongs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance,
      CASE
          WHEN rstatus = 1 THEN CONCAT('images/rest/', rimg)
          ELSE close_img
      END AS image,
      rate,
      dtime,
      atwo,
      dradius,
      full_address,
      catid,
      is_pure,
      mobile,
      catid,
      open_time,
      close_time,
      opentime_evening,
      closetime_evening,
      rstatus,
      status
    FROM
      rest_details
      WHERE id = ?
    `;

  const [data] = await pool.query(rQuery, [rid]);

  const promises = data.map(async (element) => {
    const catid = element.catid;

    if (catid) {
      const catids = catid.split(",");

      let catnm = "";
      await Promise.all(
        catids.map(async (newid) => {
          const categoryQuery = `SELECT * FROM tbl_category WHERE id = ? `;
          const [result] = await pool.query(categoryQuery, [newid]);

          const cate_name = result[0].cat_name;

          if (cate_name) {
            catnm += cate_name + ",";
          }
        })
      );

      // Remove the trailing comma
      catnm = catnm.replace(/,$/, "");

      // Update the element with the concatenated category names
      element.catname = catnm;

      // if (element.rstatus == 1 && element.status == 1) {
      //   element.is_servicable = "1";
      // } else {
      //   element.is_servicable = "0";
      // }

      setServiceability(element);

      // console.log(element.dradius);
      // console.log(element.distance);

      if (element.distance > element.dradius) {
        console.log("Yes");
        element.is_servicable = 0;
      }

      if (custId && custId !== "") {
        const isFavorited = await checkFavorite(custId, element.id);
        element.isFavorite = isFavorited;
      }
    }
  });

  // Wait for all promises to resolve
  await Promise.all(promises);

  // if (data && data.length > 0) {
  //   let { rstatus, status } = data[0];

  //   data[0].is_servicable = 0;

  //   if (rstatus == 1 && status == 1) {
  //     is_servicable = "1";
  //   } else {
  //     is_servicable = "0";
  //   }

  //   setServiceability(data[0]);
  // }

  let restData = {
    rest_id: data[0].id,
    rest_name: data[0].title,
    rest_mobile: data[0].mobile,
    rest_img: data[0].image,
    cat_name: data[0].catname,
    is_favourite: data[0].isFavorite || 0,
    open_time: data[0].open_time,
    close_time: data[0].close_time,
    opentime_evening: data[0].opentime_evening,
    closetime_evening: data[0].closetime_evening,
    rest_rating: data[0].rate,
    delivery_time: "25-30min",
    distance: data[0].distance.toFixed(2) + " Kms",
    rest_costfortwo: data[0].atwo,
    is_veg: data[0].is_pure,
    rest_full_address: data[0].full_address,
    is_servicable: data[0].is_servicable,
  };

  // Initialize categoryData object
  const categoryData = {};

  // Iterate over items
  for (const result of items) {
    const categoryId = result.id;

    // If category not added to the object, add it
    if (!categoryData[categoryId]) {
      categoryData[categoryId] = {
        id: categoryId,
        title: result.title,
        menuitem_data: [],
      };
    }

    // Check if image file exists
    const imagePath = `/images/mitem/${result.item_img}`;
    let itemImage = null;

    if (fs.existsSync(imagePath)) {
      itemImage = imagePath;
    }

    // Add product to the category
    // const menuItem = {
    //   id: result.menu_id,
    //   title: result.menu_item,
    //   gst: result.gst,
    //   item_img: itemImage,
    //   price: result.price,
    //   s_price: result.discount_price,
    //   disc_perc: (
    //     ((result.discount_price - result.price) / result.discount_price) *
    //     100
    //   ).toFixed(2),
    //   is_veg: result.is_veg,
    //   is_customize: result.is_customize,
    //   is_variations: result.is_variations,
    //   cdesc: result.cdesc,
    //   max_qty: "1",
    // };
    const menuItem = {
      id: result.menu_id,
      title: result.menu_item,
      gst: result.gst,
      item_img: itemImage,
      price: result.price,
      s_price: result.discount_price,
      disc_perc: String(
        Math.round(
          ((result.discount_price - result.price) / result.discount_price) * 100
        )
      ),
      is_veg: result.is_veg,
      is_customize: result.is_customize,
      is_variations: result.is_variations,
      cdesc: result.cdesc,
      max_qty: "1",
    };

    categoryData[categoryId].menuitem_data.push(menuItem);

    // if (result.is_variations == 1) {
    //   const addonQuery = `
    //     SELECT id, title, price, discount_price
    //     FROM addon_variations
    //     WHERE status = 1 AND items_id = ?
    //   `;

    //   const [addonVariationData] = await pool.query(addonQuery, [
    //     result.menu_id,
    //   ]);

    //   if (addonVariationData && addonVariationData.length > 0) {
    //     addonVariationData.forEach((elem) => {
    //       menuItem.addon_variations.push({
    //         addon_id: elem.id,
    //         addon_title: elem.title,
    //         addon_discount_price: elem.discount_price,
    //         addon_price: elem.price,
    //       });
    //     });
    //   }
    // }
  }

  // Filter out categories without menuitem_data
  const filteredCategoryData = Object.values(categoryData).filter(
    (category) => category.menuitem_data.length > 0
  );

  // filteredCategoryData.unshift(restDataObj);

  res
    .status(200)
    .json({ rest_data: restData, category_data: filteredCategoryData });
});

const getRestaurantCoupons = asyncHandler(async (req, res) => {
  let { rid } = req.body;

  if (!rid) {
    return res
      .status(400)
      .json({ message: "Please provide the restaurant ID", success: false });
  }

  const query = `SELECT id, c_type, c_img, c_title, ctitle, subtitle, c_value, min_amt, cc_value, status, c_desc, c_count, cdate, is_allrest, no_of_user_use FROM tbl_coupon WHERE restid = ? AND status = 1
  ORDER BY id DESC`;

  let [result] = await pool.query(query, [rid]);

  if (!result || result.length === 0) {
    return res
      .status(404)
      .json({ message: "No coupons found!", success: false });
  }

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const formattedDate = `${year}-${month}-${day}`;

  let data = [];

  result.filter((elm) => {
    const expired = elm.no_of_user_use <= elm.c_count;
    const originalDate = moment(elm.cdate);
    const convertedDate = originalDate.tz("Asia/Kolkata");
    const splitDate = convertedDate.format().split("T")[0];

    console.log(formattedDate, splitDate);

    const expired2 = formattedDate > splitDate;

    if (expired) {
      return false;
    } else if (expired2) {
      return false;
    } else {
      console.log(elm);
      data.push(elm);
    }
  });

  data.forEach((coupon) => {
    if (coupon.c_desc) {
      coupon.c_desc = coupon.c_desc.replace(/^<p>/, "").replace(/<\/p>$/, "");
    }
  });

  if (!data || data.length === 0) {
    return res
      .status(404)
      .json({ message: "No coupons found!", success: false });
  }

  let keysToRemove = ["c_count", "cdate", "is_allrest"];

  data = removeKeysFromArray(data, keysToRemove);

  res.status(200).send(data);
});

function removeKeysFromArray(array, keysToRemove) {
  return array.map((obj) => {
    keysToRemove.forEach((key) => delete obj[key]);
    return obj;
  });
}

const applyCoupon = asyncHandler(async (req, res) => {
  const { rid, couponId } = req.body;

  if (!rid) {
    return res
      .status(400)
      .json({ message: "Please provide the restaurant ID", success: false });
  }
  if (!couponId) {
    return res
      .status(400)
      .json({ message: "Please provide the coupon ID", success: false });
  }

  const query = `SELECT * FROM tbl_coupon WHERE id = ? AND restid = ? AND status = 1`;

  const [result] = await pool.query(query, [couponId, rid]);

  if (!result || result.length === 0) {
    return res
      .status(404)
      .json({ message: "Coupon Code not found!", success: false });
  }

  let data = result[0];

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const formattedDate = `${year}-${month}-${day}`;

  if (data.no_of_user_use <= data.c_count) {
    return res.status(400).json({ message: "Coupon Expired!", success: false });
  }

  if (data.is_allrest == 0 && rid != data.restid) {
    return res.status(400).json({ message: "Coupon Expired!", success: false });
  }

  const originalDate = moment(data.cdate);
  const convertedDate = originalDate.tz("Asia/Kolkata");

  const splitDate = convertedDate.format().split("T")[0];

  if (formattedDate > splitDate) {
    return res.status(400).json({ message: "Coupon Expired!", success: false });
  }

  data.cdate = splitDate;

  data.c_desc = data.c_desc.replace(/^<p>/, "").replace(/<\/p>$/, "");

  res.status(200).send(data);
});

const getFavRestaurants = asyncHandler(async (req, res) => {
  const { uid, custLats, custLongs } = req.body;

  if (!uid) {
    return res.status(400).json({
      message: "Please provide the user id.",
      success: false,
    });
  }
  if (!custLats) {
    return res.status(400).json({
      message: "Please provide the user latitude.",
      success: false,
    });
  }
  if (!custLongs) {
    return res.status(400).json({
      message: "Please provide the user longitude.",
      success: false,
    });
  }

  const query = `
    SELECT r.*, (((acos(sin((${custLats}*pi()/180)) * sin((lats*pi()/180))+cos((${custLats}*pi()/180)) * cos((lats*pi()/180)) * cos(((${custLongs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344) as distance,
    CASE 
    WHEN r.rstatus = 1 THEN r.rimg
    ELSE r.close_img
    END AS image
    FROM tbl_fav t
    LEFT JOIN rest_details r ON t.rest_id = r.id
    WHERE t.uid = ?;
  `;

  const [result] = await pool.query(query, [uid]);

  if (!result || result.length === 0) {
    return res.status(404).json({
      message: "No fav restaurant found for this user!",
      success: false,
    });
  }

  const promises = result.map(async (element) => {
    const catid = element.catid;

    if (catid) {
      const catids = catid.split(",");

      let catnm = "";
      await Promise.all(
        catids.map(async (newid) => {
          const categoryQuery = `SELECT * FROM tbl_category WHERE id = ? `;
          const [result] = await pool.query(categoryQuery, [newid]);

          const cate_name = result[0].cat_name;

          if (cate_name) {
            catnm += cate_name + ",";
          }
        })
      );

      // Remove the trailing comma
      catnm = catnm.replace(/,$/, "");

      // Update the element with the concatenated category names
      element.catname = catnm;

      // if (element.rstatus == 1 && element.status == 1) {
      //   element.is_servicable = "1";
      // } else {
      //   element.is_servicable = "0";
      // }

      setServiceability(element);

      if (element.distance > element.dradius) {
        element.is_servicable = 0;
      }
    }
  });

  // Wait for all promises to resolve
  await Promise.all(promises);

  const data = result.map((item) => {
    return {
      rest_id: item.id,
      rest_name: item.title,
      rest_mobile: item.mobile,
      rest_img: `images/rest/${item.image}`,
      cat_name: item.catname,
      rest_rating: item.rate,
      delivery_time: item.dtime + " mins",
      rest_costfortwo: item.atwo,
      is_veg: item.is_pure,
      rest_full_address: item.full_address,
      is_servicable: item.is_servicable,
      distance: item.distance.toFixed(2) + " Kms",
      token: "",
    };
  });

  res.status(200).send(data);
});

const addFavRestaurant = asyncHandler(async (req, res) => {
  const { uid, rid } = req.body;

  if (!uid) {
    return res.status(400).json({
      message: "Please provide the user id.",
      success: false,
    });
  }

  if (!rid) {
    return res.status(400).json({
      message: "Please provide the restaurant id.",
      success: false,
    });
  }

  const query = `
  INSERT into tbl_fav (uid, rest_id)
  VALUES (?, ?)
  `;

  const [result] = await pool.query(query, [uid, rid]);

  if (!result || result.length === 0) {
    return res.status(404).json({
      message: "Error while adding restaurant into favourites!",
      success: false,
    });
  }

  res.status(200).send({
    message: "Restaurant added into favourites successfully!",
    success: true,
  });
});

const deleteFavRestaurant = asyncHandler(async (req, res) => {
  const { uid, rid } = req.body;

  if (!uid) {
    return res.status(400).json({
      message: "Please provide the user id.",
      success: false,
    });
  }

  if (!rid) {
    return res.status(400).json({
      message: "Please provide the restaurant id.",
      success: false,
    });
  }

  const query = `
  DELETE from tbl_fav
  WHERE uid = ? AND rest_id = ?
  `;

  const [result] = await pool.query(query, [uid, rid]);

  if (!result || result.length === 0) {
    return res.status(404).json({
      message: "Error while removing restaurant from favourites!",
      success: false,
    });
  }

  res.status(200).send({
    message: "Restaurant removed from favourites successfully!",
    success: true,
  });
});

const calcualteDeliveryAndRestCharges = asyncHandler(async (req, res) => {
  const { rid, custLats, custLongs } = req.body;

  if (!rid) {
    return res.status(400).json({
      message: "Please provide the restaurant id.",
      success: false,
    });
  }
  if (!custLats) {
    return res.status(400).json({
      message: "Please provide the custLats.",
      success: false,
    });
  }
  if (!custLongs) {
    return res.status(400).json({
      message: "Please provide the custLongs.",
      success: false,
    });
  }

  const query = `
  SELECT ROUND((((acos(sin((${custLats}*pi()/180))*sin((lats*pi()/180))+cos((${custLats}*pi()/180))*cos((lats*pi()/180))*cos(((${custLongs}-longs)*pi()/180))))*180/pi())*60*1.1515*1.609344), 2) as distance, title, lats, longs, store_charge, ukm, uprice, aprice,
  open_time,
  close_time,
  dradius,
  opentime_evening,
  closetime_evening,
  rstatus,
  status
  FROM rest_details
  WHERE id = ?
  `;

  let [result] = await pool.query(query, [rid]);

  if (!result || result.length === 0) {
    return res.status(404).json({
      message: "Error while getting delivery charges!",
      success: false,
    });
  }

  result[0].is_servicable = 0;

  const {
    distance,
    ukm,
    uprice,
    aprice,
    store_charge,
    title,
    rstatus,
    status,
    dradius,
  } = result[0];

  if (distance > 30) {
    return res.status(400).json({
      message: "Distance exceeds 30 kilometers. Delivery is not available.",
      success: false,
    });
  }

  let deliveryCharge = uprice;

  if (distance > ukm) {
    const extraKms = distance - ukm;
    deliveryCharge += extraKms * aprice;
  } else if (distance <= ukm) {
    deliveryCharge = uprice;
  }

  // if (rstatus == 1 && status == 1) {
  //   is_servicable = "1";
  // } else {
  //   is_servicable = "0";
  // }

  setServiceability(result[0]);

  if (distance > dradius) {
    result[0].is_servicable = "0";
  }

  res.status(200).json({
    rest_title: title,
    deliveryCharge: deliveryCharge.toFixed(2),
    rest_charge: store_charge,
    is_servicable: result[0].is_servicable.toString(),
    distance: distance,
  });
});

const getCustomizeAddonAndVariation = asyncHandler(async (req, res) => {
  const data = req.body;
  const menu_id = data.menu_id;
  const rid = data.rid;

  if (!menu_id) {
    return res.status(400).json({
      message: "Please provide the menu id.",
      success: false,
    });
  }

  const menuQuery = `
  select id, title,is_customize_time,customize_times, rid, is_customize, is_egg, is_recommended, is_variations,addon from menu_item where id = ?
  `;

  const [result] = await pool.query(menuQuery, [menu_id]);

  if (!result || result.length === 0) {
    return res.status(404).json({
      message: "Error while getting customize addon and variation!",
      success: false,
    });
  }

  let resData = {
    item_id: result[0].id,
    item_title: result[0].title,
  };

  let addonData = [];

  await Promise.all(
    result.map(async (item) => {
      if (item.is_variations == 1) {
        const menuid = item.id;

        const query = `
        SELECT id, title, price, discount_price 
        FROM addon_variations 
        WHERE status=1 AND items_id= ?
        `;

        const [addonVariationData] = await pool.query(query, [menuid]);

        if (addonVariationData && addonVariationData.length > 0) {
          addonVariationData.forEach((elem) => {
            const addon_id = elem.id;
            const addon_title = elem.title;
            const addon_discount_price = elem.discount_price;
            const addon_price = elem.price;

            addonData.push({
              addon_id,
              addon_title,
              addon_discount_price,
              addon_price,
            });
          });

          // const catQuery = `
          // select id, title, atype, limits, reqs from addcat_cat where status=1 and rid= ? and addid= ?
          // `;

          // const [addCatData] = await pool.query(catQuery, [rid, addon_id]);
        }
      }

      if (item.is_customize == 1) {
      }
    })
  );

  resData.addonData = addonData;

  res.status(200).json(resData);
});

const placeOrder = asyncHandler(async (req, res) => {
  let data = req.body;

  const userMobile = data?.userMobile;

  if (!userMobile) {
    return res
      .status(400)
      .json({ message: "Please provide the user mobile.", success: false });
  }

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

    addOrder(req, res);
    // deleteUserOrder(req, res);
  } else {
    console.log("user not found");
    return res.status(404).json({ message: "User not found!", success: false });
    // addNewUser(req, res);
  }
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
  let coupon_id = data.coupon_id;
  let coupon_amount = data.coupon_amount;

  if (!uid) {
    return res
      .status(400)
      .json({ message: "Please provide the user id.", success: false });
  }
  if (!rest_id) {
    return res
      .status(400)
      .json({ message: "Please provide the rest_id.", success: false });
  }
  if (!address) {
    return res
      .status(400)
      .json({ message: "Please provide the user address.", success: false });
  }
  if (!d_charge) {
    return res
      .status(400)
      .json({ message: "Please provide the d_charge", success: false });
  }
  if (!o_total) {
    return res
      .status(400)
      .json({ message: "Please provide the o_total.", success: false });
  }
  if (!subtotal) {
    return res
      .status(400)
      .json({ message: "Please provide the subtotal.", success: false });
  }
  if (!lats) {
    return res
      .status(400)
      .json({ message: "Please provide the user latitude.", success: false });
  }
  if (!longs) {
    return res.status(400).json({
      message: "Please provide the user longitude.",
      success: false,
    });
  }
  // if (!d_distance) {
  //   res.status(400).json({
  //     message: "Please provide the delivery distance.",
  //     success: false,
  //   });
  //   throw new Error("Please provide the delivery distance.");
  // }

  if (!coupon_id) {
    coupon_id = 0;
  }
  if (!coupon_amount) {
    coupon_amount = 0;
  }

  let couponUsed;

  if (coupon_id && coupon_amount) {
    couponUsed = 1;
  } else {
    couponUsed = 0;
  }

  const query = `
  INSERT INTO tbl_order (uid, rest_id, p_method_id, address,address_id, d_charge, o_total, subtotal, lats, longs, cou_id, cou_amt, trans_id, o_status, vcommission, dcommission, wall_amt, tip, rest_charge, atype, rest_store, d_partner, dp_type, self_pickup, d_distance, odate, is_coupon_used)
  VALUES (?, ?, 0, ?,?, ?, ?, ?, ?, ?, ?, ?, 0, 'Pending', 0, 0, 0, 0, 0, 'Home', 0, 0, 0, 0, ?, CONVERT_TZ(NOW(), '+00:00', '+05:30') ,?);`;

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
    coupon_id,
    coupon_amount,
    d_distance,
    couponUsed,
  ]);

  if (!order) {
    return res
      .status(400)
      .json({ message: "Error while creating order", success: false });
  }

  const orderId = order.insertId;
  req.body.orderId = orderId;
  req.body.userId = uid;

  addProduct(req, res);
});

const placeOrderNew = asyncHandler(async (req, res) => {
  let data = req.body;

  const userMobile = data?.userMobile;

  if (!userMobile) {
    return res
      .status(400)
      .json({ message: "Please provide the user mobile.", success: false });
  }

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

    addOrderNew(req, res);
    // deleteUserOrder(req, res);
  } else {
    console.log("user not found");
    return res.status(404).json({ message: "User not found!", success: false });
    // addNewUser(req, res);
  }
});

const addOrderNew = asyncHandler(async (req, res) => {
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
  let coupon_id = data.coupon_id;
  let coupon_amount = data.coupon_amount;
  let tip = data.tip;
  let cooking_note = data.cooking_note;
  let self_pickup = data.self_pickup;
  let rest_charge = data.packaging_charge;
  let gst = data.gst;
  let device_type = data.device_type;
  let app_version = data.app_version;
  let device_name = data.device_name;
  let device_os = data.device_os;
  let p_method_id = data.p_method_id;

  if (!p_method_id) {
    return res
      .status(400)
      .json({ message: "Please provide the p_method_id.", success: false });
  }

  if (!self_pickup) {
    self_pickup = 0;
  }

  if (!rest_charge) {
    rest_charge = 0;
  }
  if (!gst) {
    gst = 0;
  }

  if (!uid) {
    return res
      .status(400)
      .json({ message: "Please provide the user id.", success: false });
  }
  if (!rest_id) {
    return res
      .status(400)
      .json({ message: "Please provide the rest_id.", success: false });
  }
  if (!address) {
    return res
      .status(400)
      .json({ message: "Please provide the user address.", success: false });
  }
  if (!d_charge) {
    return res
      .status(400)
      .json({ message: "Please provide the d_charge", success: false });
  }
  if (!o_total) {
    return res
      .status(400)
      .json({ message: "Please provide the o_total.", success: false });
  }
  if (!subtotal) {
    return res
      .status(400)
      .json({ message: "Please provide the subtotal.", success: false });
  }
  if (!lats) {
    return res
      .status(400)
      .json({ message: "Please provide the user latitude.", success: false });
  }
  if (!longs) {
    return res.status(400).json({
      message: "Please provide the user longitude.",
      success: false,
    });
  }
  // if (!d_distance) {
  //   res.status(400).json({
  //     message: "Please provide the delivery distance.",
  //     success: false,
  //   });
  //   throw new Error("Please provide the delivery distance.");
  // }

  if (!coupon_id) {
    coupon_id = 0;
  }
  if (!coupon_amount) {
    coupon_amount = 0;
  }

  let couponUsed;

  if (coupon_id && coupon_amount) {
    couponUsed = 1;
  } else {
    couponUsed = 0;
  }

  const paymentQuery = `
  SELECT * FROM tbl_payment_list WHERE id = ?
  `;

  const [paymentResult] = await pool.query(paymentQuery, [p_method_id]);

  let is_cod;

  if (paymentResult && paymentResult.length > 0) {
    const title = paymentResult[0].title;

    if (title == "Cash On Delivery") {
      is_cod = 0;
    } else {
      is_cod = 1;
    }
  }

  const query = `
  INSERT INTO tbl_order (uid, rest_id, p_method_id, address,address_id, d_charge, o_total, subtotal, lats, longs, cou_id, cou_amt, trans_id, o_status, vcommission, dcommission, wall_amt, tip, rest_charge, atype, rest_store, d_partner, dp_type, self_pickup, d_distance, odate, is_coupon_used, tax, device_type, app_version, device_name, device_os, a_note, is_cod)
  VALUES (?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, 0, 'Pending', 0, 0, 0, ?, ?, 'Home', 0, 0, 0, ?, ?, CONVERT_TZ(NOW(), '+00:00', '+05:30') ,?, ?, ?, ? ,? ,?, ?, ?);`;

  const [order] = await pool.query(query, [
    uid,
    rest_id,
    p_method_id,
    address,
    addressId,
    d_charge,
    o_total,
    subtotal,
    lats,
    longs,
    coupon_id,
    coupon_amount,
    tip,
    rest_charge,
    self_pickup,
    d_distance,
    couponUsed,
    gst,
    device_type,
    app_version,
    device_name,
    device_os,
    cooking_note,
    is_cod,
  ]);

  if (!order) {
    return res
      .status(400)
      .json({ message: "Error while creating order", success: false });
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
    return res.status(400).json({
      message: "Please provide a valid productArr",
      success: false,
    });
  }

  const query = `
    INSERT INTO tbl_order_product (oid, pid, pquantity, ptitle, pprice, is_veg, is_variation)
    VALUES ${productArr.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")};
  `;

  // Flatten the array of values for the query parameters
  const queryParams = productArr.flatMap(
    ({ id, quantity, title, price, is_veg, is_variation }) => [
      orderId,
      id,
      quantity,
      title,
      price,
      is_veg,
      is_variation,
    ]
  );

  // Execute the query with parameters
  const [insertedProducts] = await pool.query(query, queryParams);

  if (!insertedProducts) {
    return res
      .status(400)
      .json({ message: "Error while adding products.", success: false });
  }

  // res.json({
  //   data: req.body,
  //   message: "Order Placed Successfully",
  //   success: true,
  // });

  addTableOrderHistory(req, res);
});

const addTableOrderHistory = asyncHandler(async (req, res) => {
  const orderId = req.body.orderId;

  const query = `
  INSERT into tbl_order_history (ostatus, orderstatus, orderid, date_time)
  VALUES('Pending', 0, ?, CONVERT_TZ(NOW(), '+00:00', '+05:30'))
  `;

  const [result] = await pool.query(query, [orderId]);

  if (!result) {
    return res.status(400).json({
      message: "Error while adding products history.",
      success: false,
    });
  }

  await axios.get("https://waayuadmin.waayu.app/msg");

  await axios.post("https://waayuadmin.waayu.app/new_order", {
    rid: req.body.rest_id,
  });

  res.status(200).json({
    data: req.body,
    message: "Order Placed Successfully",
    success: true,
  });
});

// const getRecentOrderList = asyncHandler(async (req, res) => {
//   let { uid, offset } = req.body;

//   if (!uid) {
//     return res.status(400).json({
//       message: "Please provide the user id.",
//       success: false,
//     });
//   }

//   if (!offset) {
//     offset = 0;
//   }

//   let skip = (parseInt(offset) + 1 - 1) * 10;

//   const query = `
//     SELECT o.id, o.rest_id, o.odate, o.o_total, o.o_status, o.cou_amt, c.c_title, c.c_type, r.title AS rest_title, r.rimg, r.full_address, r.city, r.state, r.is_pure
//     FROM tbl_order o
//     LEFT JOIN rest_details r ON o.rest_id = r.id
//     LEFT JOIN tbl_coupon c ON o.cou_id = c.id
//     WHERE o.uid = ?
//     AND (
//       (o.cc_orderid IS NOT NULL AND o.payment_status = 'Success' AND o.is_cod = 1)
//       OR
//       (o.is_cod = 0 AND (o.payment_status = 'Pending' OR o.payment_status = 'Success'))
//     )
//     GROUP BY o.id
//     ORDER BY o.id DESC
//     LIMIT 10 OFFSET ?
//   `;

//   const [orders] = await pool.query(query, [uid, skip]);

//   if (!orders || orders.length === 0) {
//     return res.status(400).json({
//       message: "No orders found!",
//       success: false,
//     });
//   }

//   const orderProductsMap = {};

//   await Promise.all(
//     orders.map(async (order) => {
//       const orderId = order.id;
//       const productQuery = `
//         SELECT p.id, p.pid, p.pquantity, p.ptitle, p.addon, p.is_veg, p.is_variation
//         FROM tbl_order_product p
//         WHERE p.oid = ?
//       `;

//       const [products] = await pool.query(productQuery, [orderId]);

//       if (products && products.length > 0) {
//         const addonPromises = products.map(async (item) => {
//           if (item.is_variation == 1) {
//             const query = `
//             SELECT id as addonId, title, price, discount_price
//             FROM addon_variations
//             WHERE status = 1 AND items_id = ?
//             `;

//             const [addon] = await pool.query(query, [item.pid]);

//             return { itemId: item.id, addon };
//           }
//           return null;
//         });

//         const addons = await Promise.all(addonPromises);

//         // console.log(addons);
//         addons.forEach((addon) => {
//           if (addon) {
//             console.log(addon);
//           }
//         });
//       }

//       orderProductsMap[orderId] = products;
//     })
//   );

//   const data = orders.map((order) => ({
//     orderId: order.id,
//     rest_id: order.rest_id,
//     rest_title: order.rest_title,
//     rest_img: `images/rest/${order.rimg}`,
//     rest_full_address: order.full_address,
//     rest_city: order.city,
//     rest_state: order.state,
//     is_veg: order.is_pure,
//     delivery_time: "25-30min",
//     o_total: order.o_total,
//     o_status: order.o_status,
//     order_date: new Date(order.odate).toISOString().split("T")[0],
//     order_time: new Date(order.odate).toTimeString().split(" ")[0],
//     coupon_amount: order.cou_amt,
//     coupon_title: order.cou_amt > 0 ? order.c_title : "",
//     coupon_type: order.c_type ? order.c_type : "",
//     products: orderProductsMap[order.id] || [],
//   }));

//   res.status(200).json({
//     data,
//     success: true,
//   });
// });

const getRecentOrderList = asyncHandler(async (req, res) => {
  let { uid, offset } = req.body;

  if (!uid) {
    return res.status(400).json({
      message: "Please provide the user id.",
      success: false,
    });
  }

  if (!offset) {
    offset = 0;
  }

  let skip = (parseInt(offset) + 1 - 1) * 10;

  const query = `
    SELECT o.id, o.rest_id, o.odate, o.o_total, o.o_status, o.cou_amt, c.c_title, c.c_type, r.title AS rest_title, r.rimg, r.full_address, r.city, r.state, r.is_pure
    FROM tbl_order o
    LEFT JOIN rest_details r ON o.rest_id = r.id
    LEFT JOIN tbl_coupon c ON o.cou_id = c.id
    WHERE o.uid = ?
    AND (
      (o.cc_orderid IS NOT NULL AND o.payment_status = 'Success' AND o.is_cod = 1) 
      OR 
      (o.is_cod = 0 AND (o.payment_status = 'Pending' OR o.payment_status = 'Success'))
    )
    GROUP BY o.id
    ORDER BY o.id DESC
    LIMIT 10 OFFSET ?
  `;

  const [orders] = await pool.query(query, [uid, skip]);

  if (!orders || orders.length === 0) {
    return res.status(400).json({
      message: "No orders found!",
      success: false,
    });
  }

  const orderProductsMap = {};

  await Promise.all(
    orders.map(async (order) => {
      const orderId = order.id;
      const productQuery = `
        SELECT p.id, p.pid, p.pquantity, p.ptitle, p.pprice, p.is_veg, p.is_variation
        FROM tbl_order_product p
        WHERE p.oid = ?
      `;

      const [products] = await pool.query(productQuery, [orderId]);

      orderProductsMap[orderId] = products;
    })
  );

  const data = orders.map((order) => ({
    orderId: order.id,
    rest_id: order.rest_id,
    rest_title: order.rest_title,
    rest_img: `images/rest/${order.rimg}`,
    rest_full_address: order.full_address,
    rest_city: order.city,
    rest_state: order.state,
    is_veg: order.is_pure,
    delivery_time: "25-30min",
    o_total: order.o_total,
    o_status: order.o_status,
    order_date: new Date(order.odate).toISOString().split("T")[0],
    order_time: new Date(order.odate).toTimeString().split(" ")[0],
    coupon_amount: order.cou_amt,
    coupon_title: order.cou_amt > 0 ? order.c_title : "",
    coupon_type: order.c_type ? order.c_type : "",
    products: orderProductsMap[order.id] || [],
  }));

  res.status(200).json({
    data,
    success: true,
  });
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const orderId = req.body.orderId;

  if (!orderId) {
    return res.status(400).json({
      message: "Please provide the order id.",
      success: false,
    });
  }

  const query = `
    SELECT o.id, o.rest_id, o.odate, o.o_total, o.o_status, o.address, o.atype, o.total_discount, o.cou_id, o.cou_amt, o.tax, o.d_charge, o.rest_charge, o.tip, o.self_pickup, o.dp_type, o.rider_name, o.rider_phone, o.del_otp, o.a_note, p.title as payment_title, r.title, r.rimg, r.full_address, r.city, r.state, r.mobile as rest_mobile, u.mobile as user_mobile, c.c_title, c.subtitle, r.is_pure
    FROM tbl_order o
    LEFT JOIN rest_details r ON o.rest_id = r.id
    LEFT JOIN tbl_user u ON o.uid = u.id
    LEFT JOIN tbl_coupon c ON o.cou_id = c.id
    LEFT JOIN tbl_payment_list p ON o.p_method_id = p.id AND o.rest_id = p.rest_id
    WHERE o.id = ?
    ORDER BY o.odate DESC
  `;

  const [result] = await pool.query(query, [orderId]);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "Error while getting order details.",
      success: false,
    });
  }

  const productQuery = `
      SELECT p.pquantity, p.ptitle, p.pprice, p.is_variation, p.is_veg
      FROM tbl_order_product p
      WHERE p.oid = ?
    `;

  const [product] = await pool.query(productQuery, [orderId]);

  let deliveryOption;

  if (result[0].self_pickup == 1) {
    deliveryOption = "Self Pickup";
  } else {
    deliveryOption = "Delivery";
  }

  const data = {
    orderId: result[0].id,
    o_status: result[0].o_status,
    rest_id: result[0].rest_id,
    rest_title: result[0].title,
    rest_full_address: result[0].full_address,
    rest_city: result[0].city,
    rest_state: result[0].state,
    is_veg: result[0].is_pure,
    user_address: result[0].address,
    address_type: result[0].atype,
    delivery_option: deliveryOption,
    delivery_boy_name: result[0].rider_name || "",
    delivery_boy_mobile: result[0].rider_phone || "",
    delivery_otp: result[0].del_otp || "",
    billDetails: product,
    total_discount: result[0].total_discount || 0,
    discount_title: result[0].subtitle || "",
    coupon_title: result[0].c_title || "",
    coupon_amount: result[0].cou_amt,
    tax: result[0].tax,
    delivery_fee: result[0].d_charge,
    packaging_charge: result[0].rest_charge,
    delivery_tip: result[0].tip,
    o_total: result[0].o_total,
    payment_method: result[0].payment_title,
    cooking_note: result[0].a_note,
    // order_date: new Date(result[0].odate).toLocaleDateString("en-US", {
    //   timeZone: "Asia/Kolkata",
    // }),
    // order_time: new Date(result[0].odate).toLocaleTimeString("en-US", {
    //   timeZone: "Asia/Kolkata",
    // }),
    order_date: new Date(result[0].odate).toISOString().split("T")[0],
    order_time: new Date(result[0].odate).toTimeString().split(" ")[0],

    user_mobile: result[0].user_mobile,
    rest_mobile: result[0].rest_mobile,
  };

  res.status(200).json({
    data: data,
    success: true,
  });
});

const orderTrackingDetails = asyncHandler(async (req, res) => {
  const orderId = req.body.orderId;

  if (!orderId) {
    return res.status(400).json({
      message: "Please provide the order id.",
      success: false,
    });
  }

  const query = `
  SELECT o.id, o.rest_id, o.odate, o.self_pickup, o.o_total, o.o_status, o.address, 
         r.title, r.rimg, r.full_address, r.city, r.state, r.is_pure,
         u.name, u.mobile, 
         (
           SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'ostatus', h.ostatus,
             'tracking_id', h.tracking_id,
             'tracking_url', h.tracking_url,
             'datetime', DATE_FORMAT(h.date_time, '%Y-%m-%d %H:%i:%s')
           ))
           FROM tbl_order_history h
           WHERE o.id = h.orderid
         ) AS order_history
  FROM tbl_order o
  LEFT JOIN rest_details r ON o.rest_id = r.id
  LEFT JOIN tbl_user u ON o.uid = u.id
  WHERE o.id = ?
`;

  const [result] = await pool.query(query, [orderId]);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "Error while getting order history details.",
      success: false,
    });
  }

  const productQuery = `
      SELECT p.pquantity, p.ptitle, p.addon, p.is_veg
      FROM tbl_order_product p
      WHERE p.oid = ?
      `;

  const [product] = await pool.query(productQuery, [orderId]);

  let deliveryOption;

  if (result[0].self_pickup == 1) {
    deliveryOption = "Self Pickup";
  } else {
    deliveryOption = "Delivery";
  }

  const data = {
    orderId: result[0].id,
    o_status: result[0].o_status,
    rest_id: result[0].rest_id,
    rest_title: result[0].title,
    rest_img: `images/rest/${result[0].rimg}`,
    rest_full_address: result[0].full_address,
    rest_city: result[0].city,
    rest_state: result[0].state,
    is_veg: result[0].is_pure,
    delivery_option: deliveryOption,
    products: product,
    o_total: result[0].o_total,
    order_history: result[0].order_history,
    // order_date: new Date(result[0].odate).toLocaleDateString("en-US", {
    //   timeZone: "Asia/Kolkata",
    // }),
    // order_time: new Date(result[0].odate).toLocaleTimeString("en-US", {
    //   timeZone: "Asia/Kolkata",
    // }),
    order_date: new Date(result[0].odate).toISOString().split("T")[0],
    order_time: new Date(result[0].odate).toTimeString().split(" ")[0],
    user_name: result[0].name,
    user_mobile: result[0].mobile,
  };

  res.status(200).json({
    data: data,
    success: true,
  });
});

function createInvoice(doc, invoice) {
  const { restaurant, customer, items, totals } = invoice;

  const currDate = moment().tz("Asia/Calcutta").format("DD/MM/YYYY");
  const currTime = moment().tz("Asia/Calcutta").format("HH:mm:ss");

  // Add header
  doc.fontSize(12).text(`${currDate}, ${currTime}`, 50, 40);
  // doc.text("- Restaurant Admin Panel", { align: "right" }).moveDown(1.5);

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("TAX INVOICE", { align: "center", underline: true })
    .moveDown(1);

  doc
    .moveTo(50, doc.y) // Starting point of the line (50 is the x-coordinate, doc.y is the current y-coordinate)
    .lineTo(doc.page.width - 50, doc.y) // End point of the line (page width minus margin)
    .dash(5, { space: 5 }) // Dashed line pattern: 5 points dash, 5 points space
    .stroke()
    .undash(); // Reset dash pattern

  doc.moveDown(1);

  // Add restaurant details
  doc.fontSize(12);

  doc.font("Helvetica-Bold").text("Legal Entity Name: ", { continued: true });
  doc.font("Helvetica").text(restaurant.legalEntityName).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Restaurant Name: ", { continued: true });
  doc.font("Helvetica").text(restaurant.name).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Restaurant Address: ", { continued: true });
  doc.font("Helvetica").text(restaurant.address).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Restaurant GSTIN: ", { continued: true });
  doc.font("Helvetica").text(restaurant.gstin).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Restaurant FSSAI: ", { continued: true });
  doc.font("Helvetica").text(restaurant.fssai).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Invoice No: ", { continued: true });
  doc.font("Helvetica").text(restaurant.invoiceNumber).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Invoice Date: ", { continued: true });
  doc.font("Helvetica").text(restaurant.invoiceDate).moveDown(0.5);

  doc.moveDown(1.5);

  // Add customer details

  doc.font("Helvetica-Bold").text("Customer Name: ", { continued: true });
  doc.font("Helvetica").text(customer.name).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Mobile Number: ", { continued: true });
  doc.font("Helvetica").text(customer.mobile).moveDown(0.5);

  doc.font("Helvetica-Bold").text("Delivery Address: ", { continued: true });
  doc.font("Helvetica").text(customer.address).moveDown(1.5);

  // Add table headers
  doc.text("Item Data", { underline: true }).moveDown(1);

  const tableTop = doc.y;
  const itemColumn = 50;
  const qtyColumn = 250;
  const rateColumn = 300;
  const totalColumn = 350;

  doc.fontSize(12);
  doc.text("Item", itemColumn, tableTop);
  doc.text("Qty", qtyColumn, tableTop);
  doc.text("Rate", rateColumn, tableTop);
  doc.text("Total", totalColumn, tableTop);

  // Add table rows
  let y = tableTop + 20;

  items.forEach((item) => {
    doc.text(item.description, itemColumn, y);
    doc.text(item.quantity, qtyColumn, y);
    doc.text(item.rate, rateColumn, y);
    doc.text(item.total, totalColumn, y);
    y += 20;
  });

  doc.moveDown(1);

  doc
    .moveTo(50, y) // Starting point of the line (50 is the x-coordinate, y is the current y-coordinate)
    .lineTo(doc.page.width - 50, y) // End point of the line (page width minus margin)
    .stroke(); // Draw the line
  y += 20;
  doc.text(`Sub Total`, itemColumn, y);
  doc.text(`${totals.subTotal}`, totalColumn, y);
  y += 20;
  doc.text(`Tax`, itemColumn, y);
  doc.text(`${totals.tax}`, totalColumn, y);
  y += 20;
  doc.text(`Restaurant Packaging Charge`, itemColumn, y);
  doc.text(`${totals.packagingCharge}`, totalColumn, y);
  y += 20;
  doc.text(`Delivery Charge`, itemColumn, y);
  doc.text(`${totals.deliveryCharge}`, totalColumn, y);
  y += 20;
  doc.text(`Delivery Boy Tip`, itemColumn, y);
  doc.text(`${totals.tip}`, totalColumn, y);
  y += 20;
  doc.text(`Total`, itemColumn, y);
  doc.text(`${totals.total}`, totalColumn, y).font("Helvetica-Bold");
  y += 20;
  doc
    .moveTo(50, y) // Starting point of the line (50 is the x-coordinate, y is the current y-coordinate)
    .lineTo(doc.page.width - 50, y) // End point of the line (page width minus margin)
    .stroke(); // Draw the line
  y += 20;
  // Add amount in words
  doc.moveDown(1);
  doc.text(`Amount (in words): ${totals.amountInWords}`, itemColumn);
}

const downloadInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).json({
      message: "Please provide the order id.",
      success: false,
    });
  }

  const query = `
  SELECT o.id, o.rest_id, o.odate, o.o_total, o.subtotal, o.o_status, o.tax, o.address, o.atype, o.total_discount, o.cou_id, o.cou_amt, o.tax, o.d_charge, o.rest_charge, o.tip, r.title, r.rimg, r.full_address, r.city, r.state, r.mobile as rest_mobile, u.mobile as user_mobile, r.is_pure, r.legal_enm, r.gstin, r.lcode, u.name
  FROM tbl_order o
  LEFT JOIN rest_details r ON o.rest_id = r.id
  LEFT JOIN tbl_user u ON o.uid = u.id
  WHERE o.id = ?
`;

  const [result] = await pool.query(query, [orderId]);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "Order not found!",
      success: false,
    });
  }

  const productQuery = `
  SELECT p.pquantity, p.ptitle, p.pprice
  FROM tbl_order_product p
  WHERE p.oid = ? AND p.is_variation = 0
  `;

  const [product] = await pool.query(productQuery, [orderId]);

  let productArr = [];

  if (product && product.length > 0) {
    product.forEach((item) => {
      productArr.push({
        description: item.ptitle,
        quantity: item.pquantity,
        rate: item.pprice,
        total: parseInt(item.pquantity) * parseInt(item.pprice),
      });
    });
  }

  const currDate = new Date().toLocaleDateString();
  const toWords = new ToWords();

  let words = toWords.convert(result[0].o_total, { currency: true });
  // Create a new PDFDocument
  const doc = new PDFDocument({ font: "Helvetica", size: "A4" });

  // Example invoice data
  const invoice = {
    restaurant: {
      legalEntityName: result[0].legal_enm,
      name: result[0].title,
      address: result[0].full_address,
      gstin: result[0].gstin,
      fssai: result[0].lcode,
      invoiceNumber: result[0].lcode,
      invoiceDate: currDate,
    },
    customer: {
      name: result[0].name,
      mobile: result[0].user_mobile,
      address: result[0].address,
    },
    items: productArr,
    totals: {
      subTotal: result[0].subtotal,
      tax: result[0].tax || 0,
      packagingCharge: result[0].rest_charge || 0,
      deliveryCharge: result[0].d_charge || 0,
      tip: result[0].tip,
      total: result[0].o_total,
      amountInWords: words,
    },
  };

  // Set headers to force download
  res.setHeader("Content-Disposition", 'attachment; filename="invoice.pdf"');
  res.setHeader("Content-Type", "application/pdf");

  // Pipe the PDF to the response
  doc.pipe(res);

  // Create the invoice PDF
  createInvoice(doc, invoice);

  // Finalize the PDF
  doc.end();
});

// const downloadInvoice = asyncHandler(async (req, res) => {
//   const { orderId } = req.query;

//   if (!orderId) {
//     return res.status(400).json({
//       message: "Please provide the order id.",
//       success: false,
//     });
//   }

//   const query = `
//   SELECT o.id, o.rest_id, o.odate, o.o_total, o.subtotal, o.o_status, o.tax, o.address, o.atype, o.total_discount, o.cou_id, o.cou_amt, o.tax, o.d_charge, o.rest_charge, o.tip, r.title, r.rimg, r.full_address, r.city, r.state, r.mobile as rest_mobile, u.mobile as user_mobile, r.is_pure, r.legal_enm, r.gstin, r.lcode, u.name
//   FROM tbl_order o
//   LEFT JOIN rest_details r ON o.rest_id = r.id
//   LEFT JOIN tbl_user u ON o.uid = u.id
//   WHERE o.id = ?
// `;

//   const [result] = await pool.query(query, [orderId]);

//   if (!result || result.length === 0) {
//     return res.status(400).json({
//       message: "Order not found!",
//       success: false,
//     });
//   }

//   const productQuery = `
//   SELECT p.pquantity, p.ptitle, p.pprice
//   FROM tbl_order_product p
//   WHERE p.oid = ?
//   `;

//   const [product] = await pool.query(productQuery, [orderId]);

//   let productArr = [];

//   if (product && product.length > 0) {
//     // Create a map to track parent items and their titles
//     const parentItems = {};

//     product.forEach((item) => {
//       // Check if the item has a parent_item_id
//       if (item.parent_item_id) {
//         // If the parent item exists in the map, concatenate the titles
//         if (parentItems[item.parent_item_id]) {
//           parentItems[item.parent_item_id].description += ` (${item.ptitle})`;
//         } else {
//           // Otherwise, create a new entry in the map
//           parentItems[item.parent_item_id] = {
//             description: item.ptitle,
//             quantity: parseInt(item.pquantity),
//             rate: parseInt(item.pprice),
//             total: parseInt(item.pquantity) * parseInt(item.pprice),
//           };
//         }
//       } else {
//         // If the item is not a parent item, add it directly to the array
//         productArr.push({
//           description: item.ptitle,
//           quantity: item.pquantity,
//           rate: item.pprice,
//           total: parseInt(item.pquantity) * parseInt(item.pprice),
//         });
//       }
//     });

//     // Add parent items from the map to the product array
//     Object.values(parentItems).forEach((parentItem) => {
//       productArr.push(parentItem);
//     });
//   }

//   const currDate = new Date().toLocaleDateString();
//   const toWords = new ToWords();

//   let words = toWords.convert(result[0].o_total, { currency: true });
//   // Create a new PDFDocument
//   const doc = new PDFDocument({ font: "Helvetica", size: "A4" });

//   // Example invoice data
//   const invoice = {
//     restaurant: {
//       legalEntityName: result[0].legal_enm,
//       name: result[0].title,
//       address: result[0].full_address,
//       gstin: result[0].gstin,
//       fssai: result[0].lcode,
//       invoiceNumber: result[0].lcode,
//       invoiceDate: currDate,
//     },
//     customer: {
//       name: result[0].name,
//       mobile: result[0].user_mobile,
//       address: result[0].address,
//     },
//     items: productArr,
//     totals: {
//       subTotal: result[0].subtotal,
//       tax: result[0].tax || 0,
//       packagingCharge: result[0].rest_charge || 0,
//       deliveryCharge: result[0].d_charge || 0,
//       tip: result[0].tip,
//       total: result[0].o_total,
//       amountInWords: words,
//     },
//   };

//   // Set headers to force download
//   res.setHeader("Content-Disposition", 'attachment; filename="invoice.pdf"');
//   res.setHeader("Content-Type", "application/pdf");

//   // Pipe the PDF to the response
//   doc.pipe(res);

//   // Create the invoice PDF
//   createInvoice(doc, invoice);

//   // Finalize the PDF
//   doc.end();
// });

// Order Notification for Owner and User
const sendOrderNotification = asyncHandler(async (req, res) => {
  const { rid, oid, total, uid } = req.body;

  if (!rid) {
    return res.status(400).json({
      message: "Please provide restaurant id",
      success: false,
    });
  }
  if (!oid) {
    return res.status(400).json({
      message: "Please provide order id",
      success: false,
    });
  }
  if (!total) {
    return res.status(400).json({
      message: "Please provide the order total amount",
      success: false,
    });
  }
  if (!uid) {
    return res.status(400).json({
      message: "Please provide user id",
      success: false,
    });
  }

  const query = `
  SELECT fcm_id from rest_difk_data where rest_id= ? and status= 1
  `;

  const [fcmIds] = await pool.query(query, [rid]);

  if (!fcmIds) {
    return res.status(400).json({
      message: "No fcm id found",
      success: false,
    });
  }

  const userQuery = `
  SELECT fcm_id from tbl_user where id= ?
  `;

  const [userFcm] = await pool.query(userQuery, [uid]);
  const userFcmArray = [];

  if (userFcm && userFcm.length > 0) {
    let data = userFcm.map((item) => item.fcm_id);
    userFcmArray.push(...data);
  }

  // Extracting fcm_id values
  const fcmIdArray = fcmIds.map((item) => item.fcm_id);

  const nrtitle = "Order Received!!";
  const nrmessage = `You have a new order #${oid}, for order value ${total}. Please check your admin dashboard for complete details.`;

  const message = {
    notification: {
      title: nrtitle,
      body: nrmessage,
    },
  };
  const userTitle = "Order Placed!!";
  const userMsg = `Your new order #${oid}, for order value ${total} has been placed successfully. Please check your app for more details.`;

  const userMessage = {
    notification: {
      title: userTitle,
      body: userMsg,
    },
  };

  await sendMessageOwner(fcmIdArray, message);
  // await sendMessageOwnerIOS(fcmIdArray, message);
  await sendMessageAndroid(userFcmArray, userMessage);
  await sendMessageFlutter(userFcmArray, userMessage);

  try {
    const notificationQuery = `
    INSERT into tbl_snoti (sid, datetime, title, description)
    VALUES (?, ?, 'Order Received!!', ?)
    `;

    await pool.query(notificationQuery, [
      rid,
      getCurrentFormattedDate(),
      nrmessage,
    ]);
  } catch (error) {
    console.log(error);
  }

  res.json({ message: "Notification sent!", success: true });
});

// Order Accept Notification
const orderAcceptNotification = asyncHandler(async (req, res) => {
  const { oid, total, uid } = req.body;

  if (!oid) {
    return res.status(400).json({
      message: "Please provide order id",
      success: false,
    });
  }
  if (!total) {
    return res.status(400).json({
      message: "Please provide the order total amount",
      success: false,
    });
  }
  if (!uid) {
    return res.status(400).json({
      message: "Please provide user id",
      success: false,
    });
  }

  const userQuery = `
  SELECT fcm_id from tbl_user where id= ?
  `;

  const [userFcm] = await pool.query(userQuery, [uid]);
  const userFcmArray = [];

  if (userFcm && userFcm.length > 0) {
    let data = userFcm.map((item) => item.fcm_id);
    userFcmArray.push(...data);
  }

  const userTitle = "Order Accepted!!";
  const userMsg = `Your new order #${oid}, for order value ${total} is accepted. Please check your app for more details.`;

  const userMessage = {
    notification: {
      title: userTitle,
      body: userMsg,
    },
  };

  await sendMessageAndroid(userFcmArray, userMessage);
  await sendMessageFlutter(userFcmArray, userMessage);

  res.json({ message: "Notification sent!", success: true });
});

// On Route Notification
const onRouteNotification = asyncHandler(async (req, res) => {
  const { oid, total, uid } = req.body;

  if (!oid) {
    return res.status(400).json({
      message: "Please provide order id",
      success: false,
    });
  }
  if (!total) {
    return res.status(400).json({
      message: "Please provide the order total amount",
      success: false,
    });
  }
  if (!uid) {
    return res.status(400).json({
      message: "Please provide user id",
      success: false,
    });
  }

  const userQuery = `
  SELECT fcm_id from tbl_user where id= ?
  `;

  const [userFcm] = await pool.query(userQuery, [uid]);
  const userFcmArray = [];

  if (userFcm && userFcm.length > 0) {
    let data = userFcm.map((item) => item.fcm_id);
    userFcmArray.push(...data);
  }

  const userTitle = "Order On-Route!!";
  const userMsg = `Your order #${oid} is on its way and will arrive shortly.`;

  const userMessage = {
    notification: {
      title: userTitle,
      body: userMsg,
    },
  };

  await sendMessageAndroid(userFcmArray, userMessage);
  await sendMessageFlutter(userFcmArray, userMessage);

  res.json({ message: "Notification sent!", success: true });
});

// Order Delivered Notification
const orderDeliveredNotification = asyncHandler(async (req, res) => {
  const { oid, total, uid } = req.body;

  if (!oid) {
    return res.status(400).json({
      message: "Please provide order id",
      success: false,
    });
  }
  if (!total) {
    return res.status(400).json({
      message: "Please provide the order total amount",
      success: false,
    });
  }
  if (!uid) {
    return res.status(400).json({
      message: "Please provide user id",
      success: false,
    });
  }

  const userQuery = `
  SELECT fcm_id from tbl_user where id= ?
  `;

  const [userFcm] = await pool.query(userQuery, [uid]);
  const userFcmArray = [];

  if (userFcm && userFcm.length > 0) {
    let data = userFcm.map((item) => item.fcm_id);
    userFcmArray.push(...data);
  }

  const userTitle = "Order Delivered!!";
  const userMsg = `Your order #${oid} with a total value of ${total} has been delivered successfully!.`;

  const userMessage = {
    notification: {
      title: userTitle,
      body: userMsg,
    },
  };

  await sendMessageAndroid(userFcmArray, userMessage);
  await sendMessageFlutter(userFcmArray, userMessage);

  res.json({ message: "Notification sent!", success: true });
});

// Common Notification
const commonNotification = asyncHandler(async (req, res) => {
  const { oid, total, uid } = req.body;

  if (!oid) {
    return res.status(400).json({
      message: "Please provide order id",
      success: false,
    });
  }
  if (!total) {
    return res.status(400).json({
      message: "Please provide the order total amount",
      success: false,
    });
  }
  if (!uid) {
    return res.status(400).json({
      message: "Please provide user id",
      success: false,
    });
  }

  const userQuery = `
  SELECT fcm_id from tbl_user where id= ?
  `;

  const [userFcm] = await pool.query(userQuery, [uid]);
  const userFcmArray = [];

  if (userFcm && userFcm.length > 0) {
    let data = userFcm.map((item) => item.fcm_id);
    userFcmArray.push(...data);
  }

  const userTitle = "Order Delivered!!";
  const userMsg = `Your order #${oid} with a total value of ${total} has been delivered successfully!.`;

  const userMessage = {
    notification: {
      title: userTitle,
      body: userMsg,
    },
  };

  await sendMessageAndroid(userFcmArray, userMessage);
  await sendMessageFlutter(userFcmArray, userMessage);

  res.json({ message: "Notification sent!", success: true });
});

async function sendMessageAndroid(fcmIdArray, messageData) {
  const promises = fcmIdArray.map(async (fcmToken) => {
    const message = {
      ...messageData,
      token: fcmToken,
      android: {
        priority: "high",
      },
    };
    return adminAndroid.messaging().send(message);
  });

  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`Message sent successfully to token ${fcmIdArray[index]}`);
    } else {
      console.log(
        `Error sending message to token ${fcmIdArray[index]}:`,
        result.reason
      );
    }
  });
}

async function sendMessageFlutter(fcmIdArray, messageData) {
  const promises = fcmIdArray.map(async (fcmToken) => {
    const message = {
      ...messageData,
      token: fcmToken,
      android: {
        priority: "high",
      },
    };
    return adminFlutter.messaging().send(message);
  });

  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`Message sent successfully to token ${fcmIdArray[index]}`);
    } else {
      console.log(
        `Error sending message to token ${fcmIdArray[index]}:`,
        result.reason
      );
    }
  });
}

async function sendMessageOwner(fcmIdArray, messageData) {
  const promises = fcmIdArray.map(async (fcmToken) => {
    const message = {
      ...messageData,
      token: fcmToken,
      android: {
        priority: "high",
      },
    };
    return adminOwner.messaging().send(message);
  });

  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`Message sent successfully to token ${fcmIdArray[index]}`);
    } else {
      console.log(
        `Error sending message to token ${fcmIdArray[index]}:`,
        result.reason
      );
    }
  });
}

async function sendMessageOwnerIOS(fcmIdArray, messageData) {
  const promises = fcmIdArray.map(async (fcmToken) => {
    const message = {
      ...messageData,
      token: fcmToken,
      android: {
        priority: "high",
      },
    };
    return adminOwnerIOS.messaging().send(message);
  });

  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      console.log(`Message sent successfully to token ${fcmIdArray[index]}`);
    } else {
      console.log(
        `Error sending message to token ${fcmIdArray[index]}:`,
        result.reason
      );
    }
  });
}

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { oid, cc_orderid, status, transaction_id, pay_via } = req.body;

  if (!oid) {
    return res.status(400).json({
      message: "Please provide order id",
      success: false,
    });
  }
  if (!cc_orderid) {
    return res.status(400).json({
      message: "Please provide cc_orderid",
      success: false,
    });
  }
  if (!status) {
    return res.status(400).json({
      message: "Please provide order status",
      success: false,
    });
  }
  if (!transaction_id) {
    return res.status(400).json({
      message: "Please provide order transaction_id",
      success: false,
    });
  }

  const query = `
  UPDATE tbl_order SET o_status= ?, cc_orderid= ?, trans_id= ? WHERE id= ?
  `;

  const [result] = await pool.query(query, [
    status,
    cc_orderid,
    transaction_id,
    oid,
  ]);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "Error while updating order!",
      success: false,
    });
  }

  res
    .status(200)
    .json({ message: "Order Status Updated Successfully!", success: true });
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  let { oid, cc_orderid, status, transaction_id, pay_via } = req.body;

  if (!oid) {
    return res.status(400).json({
      message: "Please provide order id",
      success: false,
    });
  }
  // if (!cc_orderid) {
  //   return res.status(400).json({
  //     message: "Please provide cc_orderid",
  //     success: false,
  //   });
  // }
  if (!status) {
    return res.status(400).json({
      message: "Please provide order status",
      success: false,
    });
  }
  // if (!transaction_id) {
  //   return res.status(400).json({
  //     message: "Please provide order transaction_id",
  //     success: false,
  //   });
  // }

  if (!cc_orderid) {
    cc_orderid = null;
  }
  if (!transaction_id) {
    transaction_id = null;
  }

  const query = `
  UPDATE tbl_order SET payment_status= ?, cc_orderid= ?, trans_id= ? WHERE id= ?
  `;

  const [result] = await pool.query(query, [
    status,
    cc_orderid,
    transaction_id,
    oid,
  ]);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "Error while updating order!",
      success: false,
    });
  }

  res.status(200).json({
    message: "Order Payment Status Updated Successfully!",
    success: true,
  });
});

const fetchPaymentList = asyncHandler(async (req, res) => {
  const { rid, self_pickup } = req.body;

  if (!rid) {
    return res.status(400).json({
      message: "Please provide the restaurant ID.",
      success: false,
    });
  }

  let query = `
  SELECT id, title
  FROM tbl_payment_list
  WHERE rest_id = ? AND status = 1
  `;

  const queryParams = [rid];

  if (self_pickup == 1) {
    query += ` AND title = 'CCAvenue'`;
  }

  const [result] = await pool.query(query, queryParams);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "No Payment List Found!",
      success: false,
    });
  }

  res.status(200).send(result);
});

const getCCAvenuePayment = asyncHandler(async (req, res) => {
  const query = `
    SELECT rest_details.title, rest_details.id
    FROM rest_details
    WHERE rest_details.id IN (
      SELECT rest_id
      FROM tbl_payment_list
      GROUP BY rest_id
      HAVING COUNT(DISTINCT title) = 1 AND MAX(title) = 'CCAvenue'
    )
  `;

  const [result] = await pool.query(query);

  res.send(result);
});

const addQrOrders = asyncHandler(async (req, res) => {
  const { uid, rid, device_id, date_time } = req.body;

  if (!uid) {
    return res.status(400).json({
      message: "Please provide user id",
      success: false,
    });
  }
  if (!device_id) {
    return res.status(400).json({
      message: "Please provide device id",
      success: false,
    });
  }
  if (!rid) {
    return res.status(400).json({
      message: "Please provide resturant id",
      success: false,
    });
  }
  if (!date_time) {
    return res.status(400).json({
      message: "Please provide date_time",
      success: false,
    });
  }

  const query = `INSERT into qr_orders (uid, rid, device_id, date_time)
VALUES (?,?,?,?)
`;

  const [result] = await pool.query(query, [uid, rid, device_id, date_time]);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "Error while adding QR Order!",
      success: false,
    });
  }

  res
    .status(200)
    .json({ message: "QR Order Added Successfully!", success: true });
});

const addonCatToppings = asyncHandler(async (req, res) => {
  const { rid } = req.body;

  if (!rid) {
    return res.status(400).json({
      message: "Please provide resturant id",
      success: false,
    });
  }

  const query = `SELECT * FROM addon_cat WHERE rid = ? ORDER by id DESC`;

  const [result] = await pool.query(query, [rid]);

  if (!result || result.length === 0) {
    return res.status(400).json({
      message: "No Toppings Found!",
      success: false,
    });
  }

  res.status(200).json({ data: result, success: true });
});

module.exports = {
  getBannerList,
  getPopularRestaurant,
  getCravingData,
  getRestaurantNearYou,
  searchRestaurants,
  getRestaurantItemsAndCat,
  getRestaurantListAgainstCategory,
  getRestaurantCoupons,
  applyCoupon,
  getFavRestaurants,
  addFavRestaurant,
  deleteFavRestaurant,
  calcualteDeliveryAndRestCharges,
  getCustomizeAddonAndVariation,
  placeOrder,
  getRecentOrderList,
  getOrderDetails,
  orderTrackingDetails,
  placeOrderNew,
  getRestaurantItemsAndCatNew,
  getRestaurantItemsAndCatFlutter,
  downloadInvoice,
  sendOrderNotification,
  orderAcceptNotification,
  onRouteNotification,
  orderDeliveredNotification,
  commonNotification,
  updateOrderStatus,
  fetchPaymentList,
  updatePaymentStatus,
  getCCAvenuePayment,
  addQrOrders,
  addonCatToppings,
};
