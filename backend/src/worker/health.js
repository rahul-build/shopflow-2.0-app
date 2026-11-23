const express = require("express");
const { checkDatabaseConnection } = require("../config/database");

const app = express();

const PORT = Number(process.env.WORKER_PORT) || 3001;

const HEARTBEAT_TIMEOUT_MS =
  Number(process.env.WORKER_HEARTBEAT_TIMEOUT_MS) || 60000;

function startHealthServer(workerState) {
  app.get("/health/live", (req, res) => {
    if (!workerState.running || workerState.shuttingDown) {
      return res.status(503).json({
        status: "not_alive",
        service: "background-worker",
      });
    }

    return res.status(200).json({
      status: "alive",
      service: "background-worker",
    });
  });

  app.get("/health/ready", async (req, res) => {
    if (!workerState.running || workerState.shuttingDown) {
      return res.status(503).json({
        status: "not_ready",
        reason: "worker_not_running",
      });
    }

    const lastPoll = workerState.lastSuccessfulPollAt;

    if (!lastPoll || Date.now() - lastPoll > HEARTBEAT_TIMEOUT_MS) {
      return res.status(503).json({
        status: "not_ready",
        reason: "worker_heartbeat_stale",
      });
    }

    try {
      await checkDatabaseConnection();

      return res.status(200).json({
        status: "ready",
        service: "background-worker",
        database: "connected",
        lastSuccessfulPollAt: new Date(lastPoll).toISOString(),
      });
    } catch (error) {
      return res.status(503).json({
        status: "not_ready",
        database: "disconnected",
      });
    }
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Worker health server listening on port ${PORT}`);
      resolve(server);
    });

    server.once("error", reject);
  });
}

module.exports = { startHealthServer };
