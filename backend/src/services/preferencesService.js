const HttpError = require("../errors/HttpError");
const HouseholdPreferences = require("../models/HouseholdPreferences");
const { mapToObject } = require("../utils/document");
const locationService = require("./locationService");

const SINGLETON_ID = "household";
const MAX_STATUS_LABEL_LENGTH = 40;
const DEFAULT_STATUS_ORDER = ["about_to_expire", "use_soon", "expired", "fresh"];
const DEFAULT_STATUS_LABELS = {
  about_to_expire: "About to expire",
  use_soon: "Use soon",
  expired: "Expired",
  fresh: "Fresh",
};
const CARD_IMAGE_MODES = new Set(["emoji", "image"]);
const DEFAULT_LIGHT_THEME = {
  primaryColor: "#2563EB",
  accentColor: "#64748B",
  backgroundColor: "#F8FAFC",
  surfaceColor: "#FFFFFF",
  textColor: "#111827",
  freshColor: "#16A34A",
  useSoonColor: "#CA8A04",
  expiringColor: "#EA580C",
  expiredColor: "#DC2626",
};
const DEFAULT_DARK_THEME = {
  primaryColor: "#60A5FA",
  accentColor: "#94A3B8",
  backgroundColor: "#111827",
  surfaceColor: "#1F2937",
  textColor: "#F9FAFB",
  freshColor: "#4ADE80",
  useSoonColor: "#FACC15",
  expiringColor: "#FB923C",
  expiredColor: "#F87171",
};

async function getOrCreate() {
  let preferences = await HouseholdPreferences.findById(SINGLETON_ID);
  if (preferences) {
    return preferences;
  }
  const now = new Date();
  return HouseholdPreferences.create({ _id: SINGLETON_ID, createdAt: now, updatedAt: now });
}

function normalizeStatusKey(rawKey) {
  if (rawKey == null || String(rawKey).trim() === "") {
    throw new HttpError(400, "Status key is required");
  }
  let normalized = String(rawKey).trim().toLowerCase().replace(/[- ]/g, "_");
  if (["expiring", "abouttoexpire", "about_to_expire"].includes(normalized)) normalized = "about_to_expire";
  if (["use_soon", "usesoon"].includes(normalized)) normalized = "use_soon";
  if (["fresh", "allgood", "all_good"].includes(normalized)) normalized = "fresh";
  if (!DEFAULT_STATUS_ORDER.includes(normalized)) {
    throw new HttpError(400, "Unknown status key");
  }
  return normalized;
}

function sanitizeLabel(rawLabel) {
  if (rawLabel == null) {
    return null;
  }
  const label = String(rawLabel).replace(/\p{Cc}/gu, "").trim().replace(/\s+/g, " ");
  if (label === "") {
    return null;
  }
  if (label.length > MAX_STATUS_LABEL_LENGTH) {
    throw new HttpError(400, "Status labels must be 40 characters or fewer");
  }
  if (label.includes("<") || label.includes(">")) {
    throw new HttpError(400, "Status labels must be plain text");
  }
  return label;
}

function mergeStatusLabels(existingLabels, submittedLabels) {
  const merged = { ...mapToObject(existingLabels) };
  for (const [rawKey, rawLabel] of Object.entries(submittedLabels || {})) {
    const key = normalizeStatusKey(rawKey);
    const label = sanitizeLabel(rawLabel);
    if (label == null) {
      delete merged[key];
    } else {
      merged[key] = label;
    }
  }
  return merged;
}

function validateStatusOrder(submittedOrder) {
  if (!Array.isArray(submittedOrder) || submittedOrder.length !== DEFAULT_STATUS_ORDER.length) {
    throw new HttpError(400, "statusOrder must include each status exactly once");
  }
  const seen = new Set();
  const normalizedOrder = [];
  for (const rawKey of submittedOrder) {
    const key = normalizeStatusKey(rawKey);
    if (seen.has(key)) {
      throw new HttpError(400, "statusOrder contains duplicate statuses");
    }
    seen.add(key);
    normalizedOrder.push(key);
  }
  if (!DEFAULT_STATUS_ORDER.every((key) => seen.has(key))) {
    throw new HttpError(400, "statusOrder must include each status exactly once");
  }
  return normalizedOrder;
}

function validateCardImageMode(rawMode) {
  const mode = String(rawMode).trim().toLowerCase();
  if (!CARD_IMAGE_MODES.has(mode)) {
    throw new HttpError(400, "defaultCardImageMode must be emoji or image");
  }
  return mode;
}

async function validateLocation(rawLocation) {
  if (String(rawLocation).trim() === "") {
    return null;
  }
  return locationService.normalizeSupportedLocation(rawLocation);
}

function resolveStatusLabels(storedLabels) {
  const stored = mapToObject(storedLabels);
  const resolved = {};
  for (const key of DEFAULT_STATUS_ORDER) {
    let label = null;
    try {
      label = sanitizeLabel(stored[key]);
    } catch {
      label = null;
    }
    resolved[key] = label || DEFAULT_STATUS_LABELS[key];
  }
  return resolved;
}

function resolveStatusOrder(storedOrder) {
  if (!storedOrder) {
    return DEFAULT_STATUS_ORDER;
  }
  try {
    return validateStatusOrder(storedOrder);
  } catch {
    return DEFAULT_STATUS_ORDER;
  }
}

function resolveCardImageMode(storedMode) {
  if (storedMode == null || String(storedMode).trim() === "") {
    return "emoji";
  }
  try {
    return validateCardImageMode(storedMode);
  } catch {
    return "emoji";
  }
}

async function resolveLocation(storedLocation) {
  if (storedLocation == null || String(storedLocation).trim() === "") {
    return null;
  }
  try {
    return await locationService.normalizeSupportedLocation(storedLocation);
  } catch {
    return null;
  }
}

async function toResponse(preferences) {
  return {
    id: preferences._id,
    statusLabels: resolveStatusLabels(preferences.statusLabels),
    statusOrder: resolveStatusOrder(preferences.statusOrder),
    defaultCardImageMode: resolveCardImageMode(preferences.defaultCardImageMode),
    defaultQuickAddLocation: await resolveLocation(preferences.defaultQuickAddLocation),
    compactCardMode: preferences.compactCardMode != null && preferences.compactCardMode,
    createdAt: preferences.createdAt,
    updatedAt: preferences.updatedAt,
  };
}

async function get() {
  return toResponse(await getOrCreate());
}

async function update(request) {
  if (!request) {
    throw new HttpError(400, "Preferences request is required");
  }
  const preferences = await getOrCreate();
  if (request.statusLabels != null) preferences.statusLabels = mergeStatusLabels(preferences.statusLabels, request.statusLabels);
  if (request.statusOrder != null) preferences.statusOrder = validateStatusOrder(request.statusOrder);
  if (request.defaultCardImageMode != null) preferences.defaultCardImageMode = validateCardImageMode(request.defaultCardImageMode);
  if (request.defaultQuickAddLocation != null) preferences.defaultQuickAddLocation = await validateLocation(request.defaultQuickAddLocation);
  if (request.compactCardMode != null) preferences.compactCardMode = request.compactCardMode;
  preferences.updatedAt = new Date();
  return toResponse(await preferences.save());
}

function themeKey(mode, key) {
  return `${mode}_${key}`;
}

function validateColor(key, rawColor) {
  const color = String(rawColor).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new HttpError(400, `${key} must be a hex color like #RRGGBB`);
  }
  return color.toUpperCase();
}

function validateRequiredColor(key, rawColor) {
  if (rawColor == null || String(rawColor).trim() === "") {
    throw new HttpError(400, `${key} is required`);
  }
  return validateColor(key, rawColor);
}

function putValidatedPalette(validated, mode, palette) {
  for (const key of Object.keys(DEFAULT_LIGHT_THEME)) {
    validated[themeKey(mode, key)] = validateRequiredColor(`${mode}.${key}`, palette[key]);
  }
}

function validateTheme(submittedTheme) {
  if (!submittedTheme.light || !submittedTheme.dark) {
    throw new HttpError(400, "Both light and dark theme settings are required");
  }
  const validated = {};
  putValidatedPalette(validated, "light", submittedTheme.light);
  putValidatedPalette(validated, "dark", submittedTheme.dark);
  return validated;
}

function putDefaultPalette(resolved, mode, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    resolved[themeKey(mode, key)] = value;
  }
}

function applyStoredPalette(resolved, storedTheme, mode, defaults) {
  for (const key of Object.keys(defaults)) {
    let storedColor = storedTheme[themeKey(mode, key)];
    if (storedColor == null && mode === "light") storedColor = storedTheme[key];
    if (storedColor == null) storedColor = storedTheme[`${mode}.${key}`];
    if (storedColor == null) continue;
    try {
      resolved[themeKey(mode, key)] = validateColor(`${mode}.${key}`, storedColor);
    } catch {
      resolved[themeKey(mode, key)] = defaults[key];
    }
  }
}

function resolveTheme(storedThemeRaw) {
  const storedTheme = mapToObject(storedThemeRaw);
  const resolved = {};
  putDefaultPalette(resolved, "light", DEFAULT_LIGHT_THEME);
  putDefaultPalette(resolved, "dark", DEFAULT_DARK_THEME);
  applyStoredPalette(resolved, storedTheme, "light", DEFAULT_LIGHT_THEME);
  applyStoredPalette(resolved, storedTheme, "dark", DEFAULT_DARK_THEME);
  return resolved;
}

function toThemePalette(theme, mode) {
  const palette = {};
  for (const key of Object.keys(DEFAULT_LIGHT_THEME)) {
    palette[key] = theme[themeKey(mode, key)];
  }
  return palette;
}

function toThemeSettings(theme) {
  return {
    light: toThemePalette(theme, "light"),
    dark: toThemePalette(theme, "dark"),
  };
}

async function getTheme() {
  return toThemeSettings(resolveTheme((await getOrCreate()).theme));
}

async function updateTheme(request) {
  if (!request) {
    throw new HttpError(400, "Theme settings request is required");
  }
  const preferences = await getOrCreate();
  preferences.theme = validateTheme(request);
  preferences.updatedAt = new Date();
  return toThemeSettings(resolveTheme((await preferences.save()).theme));
}

async function reset() {
  const preferences = await getOrCreate();
  preferences.statusLabels = {};
  preferences.statusOrder = [];
  preferences.theme = {};
  preferences.defaultCardImageMode = null;
  preferences.defaultQuickAddLocation = null;
  preferences.compactCardMode = null;
  preferences.updatedAt = new Date();
  return toResponse(await preferences.save());
}

async function resetStatusOrder() {
  const preferences = await getOrCreate();
  preferences.statusOrder = [];
  preferences.updatedAt = new Date();
  return toResponse(await preferences.save());
}

async function resetStatusLabels() {
  const preferences = await getOrCreate();
  preferences.statusLabels = {};
  preferences.updatedAt = new Date();
  return toResponse(await preferences.save());
}

module.exports = {
  get,
  update,
  getTheme,
  updateTheme,
  reset,
  resetStatusOrder,
  resetStatusLabels,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
};
