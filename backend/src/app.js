require("dotenv").config();

const express = require("express");
const { checkDatabaseConnection } = require("./config/database");

const ordersRouter = require("./routes/orders");
const productsRouter = require("./routes/products");

const app = express();

app.use(express.json());

// Request logging middleware
// Register before routes so API requests are logged too.
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

// API routes
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);

// Liveness check
app.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "alive",
  });
});

// Readiness check
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

module.exports = app;
