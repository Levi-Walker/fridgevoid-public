const path = require("path");
const dotenv = require("dotenv");

const backendRoot = path.resolve(__dirname, "../..");
const projectRoot = path.resolve(backendRoot, "..");

dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

const defaultCorsPatterns = [
  "https://*",
  "http://localhost:[*]",
  "https://localhost:[*]",
  "http://127.0.0.1:[*]",
  "https://127.0.0.1:[*]",
  "http://192.168.*.*:[*]",
  "https://192.168.*.*:[*]",
  "http://10.*.*.*:[*]",
  "https://10.*.*.*:[*]",
  "http://172.*.*.*:[*]",
  "https://172.*.*.*:[*]",
  "http://100.*.*.*:[*]",
  "https://100.*.*.*:[*]",
  "http://*.ts.net:[*]",
  "https://*.ts.net:[*]",
];

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function numberFirstEnv(names, fallback) {
  for (const name of names) {
    const value = Number(process.env[name]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function firstEnv(names, fallback = undefined) {
  for (const name of names) {
    const value = process.env[name];
    if (value != null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function buildMongoUri() {
  const explicitUri = firstEnv(["MONGODB_URI"]);
  if (explicitUri) {
    return explicitUri;
  }

  const host = firstEnv(["MONGO_HOST"], "localhost");
  const port = numberEnv("MONGO_PORT", 27017);
  const database = firstEnv(["MONGO_DATABASE", "MONGO_DB"], "fridgevoid");
  const username = firstEnv(["MONGO_USERNAME"]);
  const password = firstEnv(["MONGO_PASSWORD"]);

  if (!username && !password) {
    return `mongodb://${host}:${port}/${database}`;
  }

  const auth = `${encodeURIComponent(username || "")}:${encodeURIComponent(password || "")}`;
  const authSource = firstEnv(["MONGO_AUTH_SOURCE"], "admin");
  return `mongodb://${auth}@${host}:${port}/${database}?authSource=${encodeURIComponent(authSource)}`;
}

function parseSize(value, fallbackBytes) {
  if (value == null || String(value).trim() === "") {
    return fallbackBytes;
  }

  const match = String(value).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    return fallbackBytes;
  }

  const amount = Number(match[1]);
  const unit = match[2] || "b";
  const multiplier = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  }[unit];

  return Math.floor(amount * multiplier);
}

function listEnv(names, fallbackValues) {
  const raw = firstEnv(names);
  return (raw || fallbackValues.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

module.exports = {
  projectRoot,
  backendRoot,
  host: firstEnv(["BACKEND_HOST", "HOST"], "0.0.0.0"),
  port: numberFirstEnv(["BACKEND_PORT", "PORT"], 8080),
  mongoUri: buildMongoUri(),
  uploadDir: path.resolve(projectRoot, firstEnv(["UPLOAD_DIR"], "uploaded-images")),
  maxUploadSize: firstEnv(["MAX_UPLOAD_SIZE"], "5mb"),
  maxUploadSizeBytes: parseSize(firstEnv(["MAX_UPLOAD_SIZE"], "5mb"), 5 * 1024 * 1024),
  corsAllowedOriginPatterns: listEnv(["CORS_ALLOWED_ORIGINS", "CORS_ALLOWED_ORIGIN_PATTERNS"], defaultCorsPatterns),
  leftovers: {
    status: {
      expiringDays: numberEnv("LEFTOVER_STATUS_EXPIRING_DAYS", 1),
      useSoonDays: numberEnv("LEFTOVER_STATUS_USE_SOON_DAYS", 3),
    },
    recoveryDays: numberEnv("LEFTOVER_RECOVERY_DAYS", 7),
    defaultLocation: process.env.LEFTOVER_DEFAULT_LOCATION || "Fridge",
  },
};
