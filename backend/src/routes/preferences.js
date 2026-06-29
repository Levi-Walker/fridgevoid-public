const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const preferencesService = require("../services/preferencesService");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  res.json(await preferencesService.get());
}));

router.put("/", asyncHandler(async (req, res) => {
  res.json(await preferencesService.update(req.body));
}));

router.post("/reset", asyncHandler(async (req, res) => {
  res.json(await preferencesService.reset());
}));

router.post("/reset-status-order", asyncHandler(async (req, res) => {
  res.json(await preferencesService.resetStatusOrder());
}));

router.post("/reset-status-labels", asyncHandler(async (req, res) => {
  res.json(await preferencesService.resetStatusLabels());
}));

module.exports = router;
