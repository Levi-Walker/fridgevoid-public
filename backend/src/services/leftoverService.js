const env = require("../config/env");
const HttpError = require("../errors/HttpError");
const Leftover = require("../models/Leftover");
const { idOf } = require("../utils/document");
const { blankToNull, normalizeImageUrl, normalizeTags, parseInstant } = require("../utils/normalize");
const imageCleanupService = require("./imageCleanupService");
const locationService = require("./locationService");
const presetService = require("./presetService");

const STATUSES = {
  EXPIRING: "EXPIRING",
  USE_SOON: "USE_SOON",
  EXPIRED: "EXPIRED",
  FRESH: "FRESH",
};

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function localDateUtcMidnight(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function deriveStatus(leftover) {
  if (!leftover.expirationDate) {
    return STATUSES.FRESH;
  }
  const now = new Date();
  const expiration = new Date(leftover.expirationDate);
  if (expiration < now) {
    return STATUSES.EXPIRED;
  }

  const daysUntilExpiration = Math.floor(
    (localDateUtcMidnight(expiration) - localDateUtcMidnight(now)) / (24 * 60 * 60 * 1000)
  );

  if (daysUntilExpiration <= env.leftovers.status.expiringDays) {
    return STATUSES.EXPIRING;
  }
  if (daysUntilExpiration <= env.leftovers.status.useSoonDays) {
    return STATUSES.USE_SOON;
  }
  return STATUSES.FRESH;
}

function recoveryCutoff() {
  return addDays(new Date(), -env.leftovers.recoveryDays);
}

function isRecoverable(leftover) {
  return leftover.deletedAt != null && leftover.deletedAt > recoveryCutoff();
}

function toResponse(leftover) {
  const deletedAt = leftover.deletedAt ?? null;
  return {
    id: idOf(leftover),
    food: leftover.food,
    expirationDate: leftover.expirationDate ?? null,
    container: leftover.container ?? null,
    emoji: leftover.emoji ?? null,
    imageUrl: leftover.imageUrl ?? null,
    notes: leftover.notes ?? null,
    location: leftover.location,
    createdAt: leftover.createdAt ?? null,
    updatedAt: leftover.updatedAt ?? null,
    deletedAt,
    recoverableUntil: deletedAt ? addDays(new Date(deletedAt), env.leftovers.recoveryDays) : null,
    recoverable: isRecoverable(leftover),
    status: deriveStatus(leftover),
    tags: leftover.tags || [],
  };
}

function parseStatus(rawStatus) {
  const status = tryParseStatus(rawStatus);
  if (!status) {
    throw new HttpError(400, "Invalid status");
  }
  return status;
}

function tryParseStatus(rawStatus) {
  if (rawStatus == null || String(rawStatus).trim() === "") {
    return null;
  }
  const normalized = String(rawStatus).trim().toUpperCase().replace(/[- ]/g, "_");
  return Object.values(STATUSES).includes(normalized) ? normalized : null;
}

function statusSortOrder(status) {
  return {
    EXPIRING: 0,
    USE_SOON: 1,
    EXPIRED: 2,
    FRESH: 3,
  }[status];
}

function compareDatesAsc(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function resolveComparator(sort) {
  if (String(sort).toLowerCase() === "updated-desc") {
    return (a, b) => compareDatesAsc(b.updatedAt, a.updatedAt);
  }
  if (String(sort).toLowerCase() === "expiration-asc") {
    return (a, b) => compareDatesAsc(a.expirationDate, b.expirationDate);
  }
  return (a, b) => {
    const statusDiff = statusSortOrder(deriveStatus(a)) - statusSortOrder(deriveStatus(b));
    if (statusDiff !== 0) return statusDiff;
    const expirationDiff = compareDatesAsc(a.expirationDate, b.expirationDate);
    if (expirationDiff !== 0) return expirationDiff;
    return compareDatesAsc(b.updatedAt, a.updatedAt);
  };
}

function matchesTag(leftover, normalizedTag, tagAsStatus) {
  if (!normalizedTag) {
    return true;
  }
  if (tagAsStatus && deriveStatus(leftover) === tagAsStatus) {
    return true;
  }
  return (leftover.tags || [])
    .filter((tag) => tag != null && String(tag).trim() !== "")
    .map((tag) => String(tag).toLowerCase())
    .some((tag) => tag === normalizedTag);
}

async function filterAndSort(leftovers, location, status, food, tag, sort) {
  const normalizedLocation = location == null || String(location).trim() === ""
    ? null
    : await locationService.normalizeSupportedLocation(location);
  const statusFilter = status == null || String(status).trim() === "" ? null : parseStatus(status);
  const normalizedFood = food == null ? null : String(food).trim().toLowerCase();
  const normalizedTag = tag == null ? null : String(tag).trim().toLowerCase();
  const tagAsStatus = !normalizedTag ? null : tryParseStatus(tag);

  return leftovers
    .filter((leftover) => normalizedLocation == null || normalizedLocation.toLowerCase() === String(leftover.location).toLowerCase())
    .filter((leftover) => !normalizedFood || (leftover.food && leftover.food.toLowerCase().includes(normalizedFood)))
    .filter((leftover) => statusFilter == null || deriveStatus(leftover) === statusFilter)
    .filter((leftover) => matchesTag(leftover, normalizedTag, tagAsStatus))
    .sort(resolveComparator(sort || "home"));
}

function resolveExpirationDate(expirationDateString, shelfLifeDays, allowPast) {
  let expirationDate;
  if (expirationDateString != null && String(expirationDateString).trim() !== "") {
    expirationDate = parseInstant(expirationDateString, "Invalid expirationDate");
  } else if (shelfLifeDays != null) {
    if (Number(shelfLifeDays) <= 0) {
      throw new HttpError(400, "shelfLifeDays must be greater than 0");
    }
    expirationDate = addDays(new Date(), Number(shelfLifeDays));
  } else {
    throw new HttpError(400, "expirationDate is required");
  }

  if (!allowPast && expirationDate < new Date()) {
    throw new HttpError(400, "expirationDate must be in the future");
  }
  return expirationDate;
}

async function getActiveEntity(id) {
  const leftover = await Leftover.findOne({ _id: id, deletedAt: null });
  if (!leftover) {
    throw new HttpError(404, "Leftover not found");
  }
  return leftover;
}

function isUpdateEmpty(req) {
  return req.food == null
    && req.expirationDate == null
    && req.shelfLifeDays == null
    && req.container == null
    && req.emoji == null
    && req.imageUrl == null
    && req.notes == null
    && req.location == null
    && req.tags == null;
}

async function create(req) {
  if (!req || req.food == null || String(req.food).trim() === "") {
    throw new HttpError(400, "Food is required");
  }
  const now = new Date();
  const leftover = await Leftover.create({
    food: String(req.food).trim(),
    expirationDate: resolveExpirationDate(req.expirationDate, req.shelfLifeDays, false),
    container: blankToNull(req.container),
    emoji: blankToNull(req.emoji),
    imageUrl: normalizeImageUrl(req.imageUrl),
    notes: blankToNull(req.notes),
    location: await locationService.normalizeSupportedLocation(req.location),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    tags: normalizeTags(req.tags),
  });

  if (req.presetId != null && String(req.presetId).trim() !== "") {
    await presetService.incrementUsedCount(String(req.presetId).trim());
  }
  return toResponse(leftover);
}

async function getAll(location, status, food, tag, sort) {
  const leftovers = await Leftover.find({ deletedAt: null });
  return (await filterAndSort(leftovers, location, status, food, tag, sort)).map(toResponse);
}

async function getHome(location) {
  const sorted = await filterAndSort(await Leftover.find({ deletedAt: null }), location, null, null, null, "home");
  const response = { expiring: [], useSoon: [], expired: [], fresh: [] };
  for (const item of sorted.map(toResponse)) {
    if (item.status === STATUSES.EXPIRING) response.expiring.push(item);
    if (item.status === STATUSES.USE_SOON) response.useSoon.push(item);
    if (item.status === STATUSES.EXPIRED) response.expired.push(item);
    if (item.status === STATUSES.FRESH) response.fresh.push(item);
  }
  return response;
}

async function update(id, req) {
  if (!req || isUpdateEmpty(req)) {
    throw new HttpError(400, "No fields provided");
  }
  const existing = await getActiveEntity(id);
  const previousImageUrl = existing.imageUrl;

  if (req.food != null) {
    if (String(req.food).trim() === "") throw new HttpError(400, "Food is required");
    existing.food = String(req.food).trim();
  }
  if (req.expirationDate != null || req.shelfLifeDays != null) {
    existing.expirationDate = resolveExpirationDate(req.expirationDate, req.shelfLifeDays, true);
  }
  if (req.container != null) existing.container = blankToNull(req.container);
  if (req.emoji != null) existing.emoji = blankToNull(req.emoji);
  if (req.imageUrl != null) existing.imageUrl = normalizeImageUrl(req.imageUrl);
  if (req.notes != null) existing.notes = blankToNull(req.notes);
  if (req.location != null) existing.location = await locationService.normalizeSupportedLocation(req.location);
  if (req.tags != null) existing.tags = normalizeTags(req.tags);
  existing.updatedAt = new Date();

  const saved = await existing.save();
  if (req.imageUrl != null && previousImageUrl !== saved.imageUrl) {
    await imageCleanupService.deleteUploadedImageIfUnreferenced(previousImageUrl);
  }
  return toResponse(saved);
}

async function softDelete(id) {
  const existing = await getActiveEntity(id);
  const now = new Date();
  existing.deletedAt = now;
  existing.updatedAt = now;
  await existing.save();
}

async function restore(id) {
  const existing = await Leftover.findById(id);
  if (!existing) throw new HttpError(404, "Leftover not found");
  if (existing.deletedAt == null) throw new HttpError(409, "Leftover is not deleted");
  if (!isRecoverable(existing)) throw new HttpError(410, "Recovery window has expired");
  existing.location = await locationService.normalizeSupportedLocation(existing.location);
  existing.deletedAt = null;
  existing.updatedAt = new Date();
  return toResponse(await existing.save());
}

async function getRecentlyDeleted(location) {
  const leftovers = await Leftover.find({ deletedAt: { $gt: recoveryCutoff() } });
  const normalizedLocation = location == null || String(location).trim() === ""
    ? null
    : await locationService.normalizeSupportedLocation(location);
  return leftovers
    .filter((leftover) => normalizedLocation == null || normalizedLocation.toLowerCase() === String(leftover.location).toLowerCase())
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
    .map(toResponse);
}

async function clear() {
  const leftovers = await Leftover.find();
  await Leftover.deleteMany({});
  const imageUrls = [...new Set(leftovers.map((leftover) => leftover.imageUrl).filter(Boolean))];
  for (const imageUrl of imageUrls) {
    await imageCleanupService.deleteUploadedImageIfUnreferenced(imageUrl);
  }
}

function make(food, emoji, imageUrl, container, notes, location, daysFromNow, tags) {
  const now = new Date();
  return {
    food,
    emoji,
    imageUrl,
    notes,
    container,
    location,
    expirationDate: addDays(new Date(), daysFromNow),
    createdAt: now,
    updatedAt: now,
    tags: [...tags],
  };
}

const SAMPLE_FOODS = [
  ["Apple", "\uD83C\uDF4E", "crisper drawer", "School lunches", ["fruit", "snack"]],
  ["Banana", "\uD83C\uDF4C", "counter bowl", "Smoothies and banana bread", ["fruit", "baking"]],
  ["Orange", "\uD83C\uDF4A", "produce bag", "Soccer practice snacks", ["fruit", "snack"]],
  ["Grapes", "\uD83C\uDF47", "produce bin", "Packed lunches", ["fruit", "snack"]],
  ["Strawberries", "\uD83C\uDF53", "berry box", "Pancakes this weekend", ["fruit", "breakfast"]],
  ["Carrot Soup", "\uD83E\uDD55", "glass container", "Work lunches", ["vegetable", "meal"]],
  ["Lemon Rice", "\uD83C\uDF4B", "meal prep tray", "Side for chicken", ["grain", "meal"]],
  ["Tomato Sauce", "\uD83C\uDF45", "mason jar", "Pizza night", ["vegetable", "sauce"]],
  ["Roast Chicken", "\uD83C\uDF57", "airtight container", "Sandwiches", ["protein", "meal"]],
  ["Burger Patty", "\uD83C\uDF54", "freezer bag", "Quick dinner backup", ["protein", "meal"]],
  ["Green Salad", "\uD83E\uDD57", "salad bowl", "Dinner side", ["vegetable", "lunch"]],
  ["Pasta Bake", "\uD83C\uDF5D", "casserole dish", "Family dinner leftovers", ["grain", "meal"]],
  ["Black Beans", "\uD83E\uDD58", "storage tub", "Taco bowls", ["protein", "meal"]],
  ["Yogurt", "\uD83E\uDD63", "single cup", "Breakfasts", ["dairy", "breakfast"]],
  ["Cheddar", "\uD83E\uDDC0", "wax wrap", "Grilled cheese", ["dairy", "snack"]],
  ["Hummus", "\uD83E\uDD59", "dip tub", "Snack plates", ["snack", "protein"]],
  ["Tuna Salad", "\uD83E\uDD6A", "deli cup", "Lunch sandwiches", ["protein", "lunch"]],
  ["Chili", "\uD83C\uDF36\uFE0F", "soup container", "Game night", ["meal", "protein"]],
  ["Broccoli", "\uD83E\uDD66", "steamer bag", "Dinner vegetables", ["vegetable", "side"]],
  ["Blueberries", "\uD83E\uDED0", "berry box", "Oatmeal toppings", ["fruit", "breakfast"]],
  ["Mushroom Risotto", "\uD83C\uDF44", "leftover bowl", "Packed dinner", ["grain", "meal"]],
  ["Pulled Pork", "\uD83C\uDF56", "sealed tub", "Sliders", ["protein", "meal"]],
  ["Cucumber Slices", "\uD83E\uDD52", "snack box", "After-school snacks", ["vegetable", "snack"]],
  ["Egg Salad", "\uD83E\uDD5A", "deli cup", "Lunch wraps", ["protein", "lunch"]],
  ["Mashed Potatoes", "\uD83E\uDD54", "covered bowl", "Shepherd's pie", ["side", "meal"]],
];

const SAMPLE_LOCATIONS = ["Fridge", "Freezer", "Pantry"];
const SAMPLE_STATUS_BUCKETS = [
  { days: [-14, -10, -7, -5, -3, -2, -1] },
  { days: [1] },
  { days: [2, 3] },
  { days: [4, 5, 6, 8, 10, 12, 14] },
];

function buildSampleItems() {
  const items = [];
  const itemsPerBucket = 25;

  SAMPLE_STATUS_BUCKETS.forEach((bucket, bucketIndex) => {
    for (let index = 0; index < itemsPerBucket; index += 1) {
      const foodIndex = (bucketIndex * itemsPerBucket + index) % SAMPLE_FOODS.length;
      const [food, emoji, container, note, tags] = SAMPLE_FOODS[foodIndex];
      const location = SAMPLE_LOCATIONS[(index + bucketIndex) % SAMPLE_LOCATIONS.length];
      const daysFromNow = bucket.days[index % bucket.days.length];
      items.push(make(
        food,
        emoji,
        null,
        container,
        note,
        location,
        daysFromNow,
        tags
      ));
    }
  });

  return items;
}

async function populate() {
  const items = buildSampleItems();
  await Leftover.insertMany(items);
  return items.length;
}

async function getById(id) {
  return toResponse(await getActiveEntity(id));
}

async function hasConflict(id, lastKnownUpdatedAt) {
  if (lastKnownUpdatedAt == null || String(lastKnownUpdatedAt).trim() === "") {
    return false;
  }
  const existing = await getActiveEntity(id);
  const knownUpdatedAt = parseInstant(lastKnownUpdatedAt, "Invalid lastKnownUpdatedAt");
  return existing.updatedAt != null && existing.updatedAt > knownUpdatedAt;
}

module.exports = {
  create,
  getAll,
  getHome,
  update,
  softDelete,
  restore,
  getRecentlyDeleted,
  clear,
  populate,
  getById,
  hasConflict,
  deriveStatus,
};
