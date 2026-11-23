require("dotenv").config();

const app = require("./app");
const { pool } = require("./config/database");

const PORT = process.env.PORT || 3000;

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
