const HttpError = require("../errors/HttpError");

function blankToNull(value) {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  return String(value).trim();
}

function normalizeImageUrl(imageUrl) {
  const trimmed = blankToNull(imageUrl);
  if (trimmed == null) {
    return null;
  }
  if (trimmed.startsWith("data:")) {
    throw new HttpError(400, "imageUrl must be an uploaded file path");
  }
  return trimmed;
}

function parseInstant(value, message) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value.trim())) {
    throw new HttpError(400, message);
  }
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new HttpError(400, message);
  }
  return date;
}

function normalizeTags(tags) {
  if (tags == null) {
    return [];
  }
  if (!Array.isArray(tags)) {
    throw new HttpError(400, "tags must be an array");
  }
  return [...new Set(
    tags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean)
  )];
}

module.exports = {
  blankToNull,
  normalizeImageUrl,
  parseInstant,
  normalizeTags,
};
