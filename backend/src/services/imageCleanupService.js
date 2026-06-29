const fs = require("fs/promises");
const path = require("path");
const env = require("../config/env");
const Leftover = require("../models/Leftover");
const Preset = require("../models/Preset");

function isManagedUpload(imageUrl) {
  return imageUrl != null && imageUrl.startsWith("/uploads/") && imageUrl.length > "/uploads/".length;
}

async function deleteUploadedImageIfUnreferenced(imageUrl) {
  if (!isManagedUpload(imageUrl)) {
    return;
  }

  if (await Preset.exists({ imageUrl })) {
    return;
  }

  if ((await Leftover.countDocuments({ imageUrl })) > 0) {
    return;
  }

  const imagePath = path.resolve(env.uploadDir, imageUrl.slice("/uploads/".length));
  if (!isInsideDirectory(imagePath, env.uploadDir)) {
    return;
  }

  try {
    await fs.unlink(imagePath);
  } catch {
    // Upload cleanup is best-effort; stale file removal should not fail the API call.
  }
}

function isInsideDirectory(filePath, directory) {
  const relative = path.relative(directory, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

module.exports = {
  deleteUploadedImageIfUnreferenced,
};
