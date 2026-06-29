const HttpError = require("../errors/HttpError");
const ScannedProduct = require("../models/ScannedProduct");
const { idOf } = require("../utils/document");

function requireCode(rawCode) {
  if (rawCode == null || String(rawCode).trim() === "") {
    throw new HttpError(400, "Code is required");
  }
  return String(rawCode).trim();
}

function requireName(rawName) {
  if (rawName == null || String(rawName).trim() === "") {
    throw new HttpError(400, "Name is required");
  }
  return String(rawName).trim();
}

function toResponse(product) {
  return {
    id: idOf(product),
    code: product.code,
    name: product.name,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function getByCode(code) {
  const normalizedCode = requireCode(code);
  const product = await ScannedProduct.findOne({ code: normalizedCode });
  if (!product) {
    throw new HttpError(404, "Scanned product not found");
  }
  return toResponse(product);
}

async function saveByCode(code, name) {
  const now = new Date();
  const existing = await ScannedProduct.findOne({ code });
  if (existing) {
    existing.name = name;
    existing.updatedAt = now;
    return { product: toResponse(await existing.save()), created: false };
  }

  try {
    const product = await ScannedProduct.create({ code, name, createdAt: now, updatedAt: now });
    return { product: toResponse(product), created: true };
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
    const conflicted = await ScannedProduct.findOne({ code });
    conflicted.name = name;
    conflicted.updatedAt = now;
    return { product: toResponse(await conflicted.save()), created: false };
  }
}

async function createOrUpdate(request) {
  if (!request) {
    throw new HttpError(400, "Scanned product request is required");
  }
  return saveByCode(requireCode(request.code), requireName(request.name));
}

async function renameOrCreate(code, request) {
  if (!request) {
    throw new HttpError(400, "Scanned product request is required");
  }
  return saveByCode(requireCode(code), requireName(request.name));
}

module.exports = {
  getByCode,
  createOrUpdate,
  renameOrCreate,
};
