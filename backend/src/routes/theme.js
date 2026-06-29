const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const preferencesService = require("../services/preferencesService");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  res.json(await preferencesService.getTheme());
}));

router.put("/", asyncHandler(async (req, res) => {
  res.json(await preferencesService.updateTheme(req.body));
}));

module.exports = router;
