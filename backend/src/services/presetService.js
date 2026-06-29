const HttpError = require("../errors/HttpError");
const Preset = require("../models/Preset");
const { idOf } = require("../utils/document");
const { blankToNull, normalizeImageUrl, normalizeTags } = require("../utils/normalize");
const imageCleanupService = require("./imageCleanupService");

function toResponse(preset) {
  return {
    id: idOf(preset),
    name: preset.name,
    shelfLifeDays: preset.shelfLifeDays,
    container: preset.container ?? null,
    emoji: preset.emoji ?? null,
    imageUrl: preset.imageUrl ?? null,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    usedCount: preset.usedCount,
    tags: preset.tags || [],
  };
}

function validateRequest(req) {
  if (!req || req.name == null || String(req.name).trim() === "") {
    throw new HttpError(400, "Preset name is required");
  }
  if (req.shelfLifeDays == null || Number(req.shelfLifeDays) <= 0) {
    throw new HttpError(400, "shelfLifeDays must be greater than 0");
  }
}

function applyEditableFields(preset, req) {
  preset.name = String(req.name).trim();
  preset.shelfLifeDays = req.shelfLifeDays;
  preset.container = blankToNull(req.container);
  preset.emoji = blankToNull(req.emoji);
  preset.imageUrl = normalizeImageUrl(req.imageUrl);
  preset.tags = normalizeTags(req.tags);
}

async function getAll() {
  return (await Preset.find().sort({ usedCount: -1, createdAt: -1 })).map(toResponse);
}

async function getById(id) {
  const preset = await Preset.findById(id);
  if (!preset) {
    throw new HttpError(404, "Preset not found");
  }
  return toResponse(preset);
}

async function create(req) {
  validateRequest(req);
  const now = new Date();
  const preset = new Preset({ createdAt: now, updatedAt: now, usedCount: 0 });
  applyEditableFields(preset, req);
  return toResponse(await preset.save());
}

async function update(id, req) {
  validateRequest(req);
  const preset = await Preset.findById(id);
  if (!preset) {
    throw new HttpError(404, "Preset not found");
  }

  const previousImageUrl = preset.imageUrl;
  applyEditableFields(preset, req);
  preset.updatedAt = new Date();
  const saved = await preset.save();
  if (previousImageUrl !== saved.imageUrl) {
    await imageCleanupService.deleteUploadedImageIfUnreferenced(previousImageUrl);
  }
  return toResponse(saved);
}

async function incrementUsedCount(id) {
  const preset = await Preset.findById(id);
  if (!preset) {
    throw new HttpError(404, "Preset not found");
  }
  preset.usedCount = preset.usedCount == null ? 1 : preset.usedCount + 1;
  await preset.save();
}

async function remove(id) {
  const preset = await Preset.findById(id);
  if (!preset) {
    throw new HttpError(404, "Preset not found");
  }
  const imageUrl = preset.imageUrl;
  await preset.deleteOne();
  await imageCleanupService.deleteUploadedImageIfUnreferenced(imageUrl);
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  incrementUsedCount,
  remove,
};
