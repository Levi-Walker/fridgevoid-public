const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const leftoverService = require("../services/leftoverService");

const router = express.Router();

router.post("/sample-data/populate", asyncHandler(async (req, res) => {
  const count = await leftoverService.populate();
  res.json({ message: "Database populated", insertedCount: count });
}));

module.exports = router;
