const env = require("../config/env");
const HttpError = require("../errors/HttpError");
const LocationConfig = require("../models/LocationConfig");
const Leftover = require("../models/Leftover");
const { idOf } = require("../utils/document");

const BUILT_IN_LOCATIONS = ["Fridge", "Freezer", "Pantry"];

function normalizeName(value) {
  return String(value).trim().toLowerCase();
}

function sanitizeDisplayName(rawName) {
  if (rawName == null || String(rawName).trim() === "") {
    throw new HttpError(400, "Location name is required");
  }
  return String(rawName).trim();
}

function toResponse(locationConfig) {
  return {
    id: idOf(locationConfig),
    name: locationConfig.name,
    defaultLocation: false,
    removable: true,
  };
}

async function getAll() {
  const locations = new Map();

  for (const builtInLocation of BUILT_IN_LOCATIONS) {
    locations.set(normalizeName(builtInLocation), {
      id: normalizeName(builtInLocation),
      name: builtInLocation,
      defaultLocation: true,
      removable: false,
    });
  }

  const customLocations = await LocationConfig.find();
  for (const locationConfig of customLocations) {
    locations.set(locationConfig.normalizedName, toResponse(locationConfig));
  }

  return Array.from(locations.values()).sort((a, b) => {
    if (a.defaultLocation !== b.defaultLocation) {
      return a.defaultLocation ? -1 : 1;
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

async function create(rawName) {
  const name = sanitizeDisplayName(rawName);
  const normalizedName = normalizeName(name);

  if (BUILT_IN_LOCATIONS.some((location) => normalizeName(location) === normalizedName)) {
    throw new HttpError(409, "Location already exists");
  }

  if (await LocationConfig.exists({ normalizedName })) {
    throw new HttpError(409, "Location already exists");
  }

  const saved = await LocationConfig.create({
    name,
    normalizedName,
    createdAt: new Date(),
  });

  return toResponse(saved);
}

async function isLocationInUse(locationName) {
  const cutoff = new Date(Date.now() - env.leftovers.recoveryDays * 24 * 60 * 60 * 1000);
  const leftovers = await Leftover.find({ location: new RegExp(`^${escapeRegExp(locationName)}$`, "i") });
  return leftovers.some((leftover) => leftover.deletedAt == null || leftover.deletedAt > cutoff);
}

async function remove(id) {
  const locationConfig = await LocationConfig.findById(id);
  if (!locationConfig) {
    throw new HttpError(404, "Location not found");
  }

  if (await isLocationInUse(locationConfig.name)) {
    throw new HttpError(409, "Location is still in use");
  }

  await locationConfig.deleteOne();
}

async function normalizeSupportedLocation(rawLocation) {
  const requestedLocation = rawLocation == null || String(rawLocation).trim() === ""
    ? env.leftovers.defaultLocation
    : sanitizeDisplayName(rawLocation);
  const normalized = normalizeName(requestedLocation);

  for (const builtInLocation of BUILT_IN_LOCATIONS) {
    if (normalizeName(builtInLocation) === normalized) {
      return builtInLocation;
    }
  }

  const customLocation = await LocationConfig.findOne({ normalizedName: normalized });
  if (!customLocation) {
    throw new HttpError(400, "Unknown location");
  }
  return customLocation.name;
}

async function isKnownLocation(rawLocation) {
  try {
    await normalizeSupportedLocation(rawLocation);
    return true;
  } catch (error) {
    if (error instanceof HttpError) {
      return false;
    }
    throw error;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  BUILT_IN_LOCATIONS,
  getAll,
  create,
  remove,
  normalizeSupportedLocation,
  isKnownLocation,
  normalizeName,
};
