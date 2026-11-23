const express = require("express");
const { pool } = require("../config/database");

const router = express.Router();

router.post("/", async (req, res) => {
  const { customer_name, customer_email, items } = req.body;

  if (
    !customer_name ||
    !customer_email ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Customer details and order items are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const { productId, quantity } = item;

      if (
        !Number.isInteger(Number(productId)) ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw new Error("Invalid product ID or quantity");
      }

      const result = await client.query(
        `SELECT id, name, price, stock_quantity
         FROM products
         WHERE id = $1 AND is_active = TRUE
         FOR UPDATE`,
        [productId],
      );

      if (result.rows.length === 0) {
        throw new Error(`Product ${productId} not found`);
      }

      const product = result.rows[0];

      if (product.stock_quantity < quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const subtotal = Number(product.price) * quantity;
      totalAmount += subtotal;

      orderItems.push({
        productId: product.id,
        quantity,
        price: product.price,
        subtotal,
      });

      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2`,
        [quantity, productId],
      );
    }

    const orderResult = await client.query(
      `INSERT INTO orders
       (customer_name, customer_email, total_amount, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, status, total_amount`,
      [customer_name, customer_email, totalAmount],
    );

    const order = orderResult.rows[0];

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.productId, item.quantity, item.price, item.subtotal],
      );
    }

    // Add a background job for this order.
    await client.query(
      `INSERT INTO jobs (order_id, job_type, status)
       VALUES ($1, $2, $3)`,
      [order.id, "process_order", "pending"],
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      JSON.stringify({
        level: "error",
        message: "Order creation failed",
        errorMessage: error.message,
      }),
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
