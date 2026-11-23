const express = require("express");
const { pool } = require("../config/database");

const router = express.Router();

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        price,
        stock_quantity
      FROM products
      WHERE is_active = TRUE
      ORDER BY id ASC
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to retrieve products",
        errorCode: error.code,
        errorMessage: error.message,
      }),
    );

    res.status(500).json({
      success: false,
      message: "Unable to retrieve products",
    });
  }
});

module.exports = router;
