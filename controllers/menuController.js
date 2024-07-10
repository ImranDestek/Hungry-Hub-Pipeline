const pool = require("../db/pool");
const asyncHandler = require("express-async-handler");

// @desc Get all menu items of a restaurant
// @route POST /api/menu/rest
const getAllMenuItemsOfRestaurant = asyncHandler(async (req, res) => {
  const { rid, search } = req.body;

  if (!rid) {
    return res
      .status(400)
      .json({ message: "Please provide the restaurant ID.", success: false });
  }

  const page = parseInt(req.body.page, 10) || 1;
  const itemsPerPage = 10;
  const offset = (page - 1) * itemsPerPage;

  // Define the base count query and parameters
  let countQuery = `SELECT COUNT(*) as totalItems FROM menu_item WHERE rid = ?`;
  let countQueryParams = [rid];

  // Modify the count query and parameters if there's a search term
  if (search) {
    countQuery += ` AND title LIKE ?`;
    countQueryParams.push(`%${search}%`);
  }

  // Define the base menu query and parameters
  let menuQuery = `
    SELECT m.*, r.title AS category_name
    FROM menu_item m
    LEFT JOIN rest_cat r ON m.menuid = r.id
    WHERE m.rid = ?
  `;
  let queryParams = [rid];

  // Modify the menu query and parameters if there's a search term
  if (search) {
    menuQuery += ` AND m.title LIKE ?`;
    queryParams.push(`%${search}%`);
  }

  // Append ordering and pagination to the menu query
  menuQuery += ` ORDER BY m.id DESC LIMIT ? OFFSET ?`;
  queryParams.push(itemsPerPage, offset);

  try {
    // Execute the count query to get the total number of items
    const [countResult] = await pool.query(countQuery, countQueryParams);
    const totalItems = countResult[0].totalItems;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Execute the menu query to get the actual menu items
    const [menu] = await pool.query(menuQuery, queryParams);

    if (!menu || menu.length === 0) {
      return res
        .status(404)
        .json({ message: "Menu not found!", success: false });
    }

    const data = menu.map((item) => {
      return {
        id: item.id,
        rid: item.rid,
        title: item.title,
        item_img: `/images/mitem/${item.item_img}`,
        status: item.status,
        price: item.price,
        gst: item.gst,
        discount_price: item.discount_price,
        is_veg: item.is_veg,
        is_customize: item.is_customize,
        is_egg: item.is_egg,
        is_recommended: item.is_recommended,
        is_variations: item.is_variations,
        cdesc: item.cdesc,
        addon: item.addon,
        menuid: item.menuid,
        petpooja_taxes: item.petpooja_taxes,
        petpooja_id: item.petpooja_id,
        is_petpooja: item.is_petpooja,
        is_customize_time: item.is_customize_time,
        customize_times: item.customize_times,
        is_deleted: item.is_deleted,
        category_name: item.category_name,
      };
    });

    res.status(200).json({
      data: data,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching menu items.",
      success: false,
      error: error.message,
    });
  }
});

// @desc Get all menu items of a restaurant
// @route PUT /api/menu/rest/update
const updateRestaurantMenuItems = asyncHandler(async (req, res) => {
  const menuItems = req.body;

  if (!menuItems || menuItems.length === 0) {
    res.status(400);
    throw new Error("Please provide valid data for menu item updates.");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const menuItem of menuItems) {
      const {
        id,
        rid,
        title,
        status,
        price,
        gst,
        discount_price,
        cdesc,
        customize_times,
        menuid,
      } = menuItem;

      const customizeTimesString = JSON.stringify(customize_times);

      const updateQuery = `
        UPDATE menu_item
        SET
          title = ?,
          status = ?,
          price = ?,
          gst = ?,
          discount_price = ?,
          cdesc = ?,
          menuid = ?,
          customize_times = ?
        WHERE id = ? AND rid = ?
      `;

      const [updatedData] = await connection.query(updateQuery, [
        title,
        status,
        price,
        gst,
        discount_price,
        cdesc,
        menuid,
        customizeTimesString,
        id,
        rid,
      ]);

      if (!updatedData || updatedData.affectedRows <= 0) {
        await connection.rollback();
        res.status(400);
        throw new Error("Error while updating menu item!");
      }
    }

    // Commit the transaction
    await connection.commit();

    res
      .status(200)
      .json({ success: true, message: "Menu items updated successfully." });
  } catch (error) {
    // Rollback the transaction in case of an error
    await connection.rollback();
    console.log("rolling back");

    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// Search Menu Items
const searchMenuItems = asyncHandler(async (req, res) => {
  const title = req.query.q;
  const rid = req.query.rid;

  if (!title) {
    res.status(400);
    throw new Error("Please provide the title for searching.");
  }
  if (!rid) {
    res.status(400);
    throw new Error("Please provide the restaurant ID.");
  }

  const page = parseInt(req.query.page, 10) || 1;
  const itemsPerPage = 25;
  const offset = (page - 1) * itemsPerPage;

  const countQuery = `
    SELECT COUNT(*) as totalItems
    FROM menu_item
    WHERE title LIKE ? AND rid = ?
  `;

  const menuQuery = `
    SELECT *
    FROM menu_item
    WHERE title LIKE ? AND rid = ?
    ORDER BY id DESC
    LIMIT ${itemsPerPage}
    OFFSET ${offset}
  `;

  const searchTitle = `%${title}%`;

  const [countResult] = await pool.query(countQuery, [searchTitle, rid]);
  const totalItems = countResult[0].totalItems;

  const [menu] = await pool.query(menuQuery, [searchTitle, rid]);

  if (!menu || menu.length === 0) {
    res.status(404).json({ message: "No menu found!", success: false });
    throw new Error("No menu items found for the given search.");
  }

  res.status(200).json({ menu: menu, totalItems: totalItems, success: true });
});

module.exports = {
  getAllMenuItemsOfRestaurant,
  updateRestaurantMenuItems,
  searchMenuItems,
};
