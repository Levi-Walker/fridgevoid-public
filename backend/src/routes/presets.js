const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const presetService = require("../services/presetService");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  res.json(await presetService.getAll());
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await presetService.getById(req.params.id));
}));

router.post("/", asyncHandler(async (req, res) => {
  res.status(201).json(await presetService.create(req.body));
}));

router.put("/:id", asyncHandler(async (req, res) => {
  res.json(await presetService.update(req.params.id, req.body));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await presetService.remove(req.params.id);
  res.json({ message: "Preset deleted" });
}));

module.exports = router;
