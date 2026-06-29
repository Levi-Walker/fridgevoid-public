const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const env = require("../config/env");
const HttpError = require("../errors/HttpError");

async function ensureUploadDir() {
  await fs.mkdir(env.uploadDir, { recursive: true });
}

function extractExtension(originalFilename) {
  if (originalFilename == null) {
    return "";
  }
  const trimmed = String(originalFilename).trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot < 0 || lastDot === trimmed.length - 1) {
    return "";
  }
  const extension = trimmed.slice(lastDot).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : "";
}

async function store(file) {
  if (!file || file.size === 0) {
    throw new HttpError(400, "File is required");
  }
  if (!file.mimetype || !file.mimetype.toLowerCase().startsWith("image/")) {
    throw new HttpError(400, "Only image uploads are allowed");
  }

  await ensureUploadDir();
  const filename = `${crypto.randomUUID()}${extractExtension(file.originalname)}`;
  const destination = path.resolve(env.uploadDir, filename);
  if (!isInsideDirectory(destination, env.uploadDir)) {
    throw new HttpError(400, "Invalid file name");
  }
  try {
    await fs.writeFile(destination, file.buffer);
  } catch {
    throw new HttpError(500, "Failed to store file");
  }
  return `/uploads/${filename}`;
}

function isInsideDirectory(filePath, directory) {
  const relative = path.relative(directory, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

module.exports = {
  ensureUploadDir,
  store,
};
