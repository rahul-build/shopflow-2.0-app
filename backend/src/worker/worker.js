require("dotenv").config();

const { pool } = require("../config/database");
const { startHealthServer } = require("./health");

const POLL_INTERVAL = 5000;

let shuttingDown = false;

const workerState = {
  running: false,
  shuttingDown: false,
  lastSuccessfulPollAt: null,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processNextJob() {
  const client = await pool.connect();
  let job;

  try {
    await client.query("BEGIN");

    const result = await client.query(`
      SELECT id, order_id
      FROM jobs
      WHERE status = 'pending'
        AND scheduled_at <= NOW()
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (result.rows.length === 0) {
      await client.query("COMMIT");
      return false;
    }

    job = result.rows[0];

    await client.query(
      `UPDATE jobs
       SET status = 'processing',
           attempts = attempts + 1,
           started_at = NOW()
       WHERE id = $1`,
      [job.id],
    );

    await client.query(
      `UPDATE orders SET status = 'processing' WHERE id = $1`,
      [job.order_id],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log(`Processing job ${job.id}, order ${job.order_id}`);

  const completionClient = await pool.connect();

  try {
    await completionClient.query("BEGIN");

    await completionClient.query(
      `UPDATE jobs
       SET status = 'completed',
           completed_at = NOW()
       WHERE id = $1`,
      [job.id],
    );

    await completionClient.query(
      `UPDATE orders SET status = 'completed' WHERE id = $1`,
      [job.order_id],
    );

    await completionClient.query("COMMIT");

    console.log(`Completed job ${job.id}`);
  } catch (error) {
    await completionClient.query("ROLLBACK");
    throw error;
  } finally {
    completionClient.release();
  }

  return true;
}

async function startWorker() {
  let healthServer;

  try {
    workerState.running = true;

    healthServer = await startHealthServer(workerState);

    console.log("Background worker started");

    while (!shuttingDown) {
      try {
        const jobFound = await processNextJob();

        // Updated after a successful polling and processing cycle.
        // A cycle with no pending jobs also counts as successful.
        workerState.lastSuccessfulPollAt = Date.now();

        if (!jobFound) {
          await sleep(POLL_INTERVAL);
        }
      } catch (error) {
        console.error("Worker error:", error.message);
        await sleep(POLL_INTERVAL);
      }
    }
  } finally {
    workerState.shuttingDown = true;
    workerState.running = false;

    if (healthServer) {
      await new Promise((resolve, reject) => {
        healthServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await pool.end();

    console.log("Worker stopped");
  }
}

function shutdown(signal) {
  if (shuttingDown) return;

  console.log(`${signal} received. Starting graceful shutdown.`);

  shuttingDown = true;
  workerState.shuttingDown = true;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startWorker().catch((error) => {
  console.error("Fatal worker error:", error);
  process.exitCode = 1;
});
