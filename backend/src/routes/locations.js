const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const locationService = require("../services/locationService");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  res.json(await locationService.getAll());
}));

router.post("/", asyncHandler(async (req, res) => {
  const location = await locationService.create(req.body?.name);
  res.status(201).json({ message: "Location created", location });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await locationService.remove(req.params.id);
  res.json({ message: "Location deleted" });
}));

module.exports = router;
