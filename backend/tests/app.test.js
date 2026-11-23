const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../src/config/database");

const app = require("../src/app");

let server;
let baseUrl;

// Start the application before running tests.
before(async () => {
  server = app.listen(0, "127.0.0.1");

  // Wait until the server is actually listening.
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

// Stop the application after all tests finish.
after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

// Test 1: Root endpoint
test("GET / should return application information", async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.application, "ShopFlow 2.0");
  assert.equal(body.status, "running");
});

// Test 2: Liveness endpoint
test("GET /health/live should return alive", async () => {
  const response = await fetch(`${baseUrl}/health/live`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "alive");
});

