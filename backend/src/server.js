
require("dotenv").config();
const ordersRouter = require("./routes/orders");
const productsRouter = require("./routes/products");
const express = require("express");
const { pool, checkDatabaseConnection } = require("./config/database");

const app = express();

app.use(express.json());

app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);

const PORT = process.env.PORT || 3000;

// Structured request logging
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
      }),
    );
  });

  next();
});

// Liveness check
app.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "alive",
  });
});

// Readiness check - includes database connectivity
app.get("/health/ready", async (req, res) => {
  try {
    const dbResult = await checkDatabaseConnection();

    res.status(200).json({
      status: "ready",
      database: "connected",
      databaseTime: dbResult.current_time,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Database readiness check failed",
        errorCode: error.code,
        errorMessage: error.message,
      }),
    );

    res.status(503).json({
      status: "not_ready",
      database: "disconnected",
    });
  }
});
// Root endpoint
app.get("/", (req, res) => {
  res.json({
    application: "ShopFlow 2.0",
    service: "Backend API",
    status: "running",
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "ShopFlow backend started",
      port: PORT,
    }),
  );
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down backend...");

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
