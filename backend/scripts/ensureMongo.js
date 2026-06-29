const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const env = require("../src/config/env");

const timeoutMs = Number(process.env.MONGO_WAIT_TIMEOUT_MS || 30000);
const intervalMs = 500;

function runDockerCompose() {
  const envFile = path.join(env.projectRoot, ".env");
  const args = ["compose"];
  if (fs.existsSync(envFile)) {
    args.push("--env-file", ".env");
  }
  args.push("-f", "docker-compose.yml", "up", "-d", "mongo");

  const result = spawnSync(
    "docker",
    args,
    {
      cwd: env.projectRoot,
      encoding: "utf8",
      stdio: "pipe",
    }
  );

  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr.trim()}` : "";
    const stdout = result.stdout ? `\n${result.stdout.trim()}` : "";
    throw new Error(`Failed to start MongoDB with Docker Compose.${stderr || stdout}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMongo() {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: intervalMs,
        dbName: process.env.MONGO_HEALTHCHECK_DATABASE || "admin",
      });
      await mongoose.disconnect();
      return;
    } catch (error) {
      lastError = error;
      await mongoose.disconnect().catch(() => {});
      await sleep(intervalMs);
    }
  }

  throw new Error(`MongoDB did not become available within ${timeoutMs}ms: ${lastError?.message || "unknown error"}`);
}

async function main() {
  runDockerCompose();
  await waitForMongo();
  console.log("MongoDB is running and reachable.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
