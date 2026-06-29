const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const scannedProductService = require("../services/scannedProductService");

const router = express.Router();

router.get("/:code", asyncHandler(async (req, res) => {
  res.json(await scannedProductService.getByCode(req.params.code));
}));

router.post("/", asyncHandler(async (req, res) => {
  const result = await scannedProductService.createOrUpdate(req.body);
  res.status(result.created ? 201 : 200).json(result.product);
}));

router.put("/:code", asyncHandler(async (req, res) => {
  const result = await scannedProductService.renameOrCreate(req.params.code, req.body);
  res.status(result.created ? 201 : 200).json(result.product);
}));

module.exports = router;
