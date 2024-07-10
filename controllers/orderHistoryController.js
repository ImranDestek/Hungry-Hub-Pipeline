const pool = require("../db/pool");

const asyncHandler = require("express-async-handler");

// @desc Get user order
// @route GET /api/order-history/user
const getUserOrderHistory = asyncHandler(async (req, res) => {
  console.log(req.body);
  const userId = req?.body?.orderId;

  if (!userId) {
    res.status(400);
    throw new Error("Please provide the user ID.");
  }

  // Fetch single user based on orderId
  const userQuery = `
        SELECT *
        FROM tbl_order_history
        WHERE orderid = ?
      `;

  const [userResult] = await pool.query(userQuery, [userId]);

  if (!userResult || userResult.length === 0) {
    res.status(404);
    throw new Error("User not found.");
  }

  res.status(200).json({ user: userResult[0], success: true });
});

module.exports = {
  getUserOrderHistory,
};
