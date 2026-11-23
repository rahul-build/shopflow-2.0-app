const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle unexpected PostgreSQL pool errors
pool.on("error", (error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Unexpected PostgreSQL pool error",
      errorCode: error.code,
      errorMessage: error.message,
    }),
  );
});

// Check database connectivity
async function checkDatabaseConnection() {
  const result = await pool.query("SELECT NOW() AS current_time");

  return result.rows[0];
}

module.exports = {
  pool,
  checkDatabaseConnection,
};
