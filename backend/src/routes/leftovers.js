const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const HttpError = require("../errors/HttpError");
const leftoverService = require("../services/leftoverService");

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const saved = await leftoverService.create(req.body);
  res.status(201).json({ message: "Leftover created", id: saved.id, item: saved });
}));

router.get("/", asyncHandler(async (req, res) => {
  res.json(await leftoverService.getAll(req.query.location, req.query.status, req.query.food, req.query.tag, req.query.sort || "home"));
}));

router.get("/home", asyncHandler(async (req, res) => {
  res.json(await leftoverService.getHome(req.query.location));
}));

router.get("/recently-deleted", asyncHandler(async (req, res) => {
  res.json(await leftoverService.getRecentlyDeleted(req.query.location));
}));

router.delete("/clear", asyncHandler(async (req, res) => {
  await leftoverService.clear();
  res.type("text/plain").send("Cleared");
}));

router.post("/populate", asyncHandler(async (req, res) => {
  const count = await leftoverService.populate();
  res.json({ message: "Database populated", insertedCount: count });
}));

router.get("/search", asyncHandler(async (req, res) => {
  if (req.query.food == null) {
    throw new HttpError(400, "food is required");
  }
  res.json(await leftoverService.getAll(req.query.location, null, req.query.food, null, "home"));
}));

router.get("/filter", asyncHandler(async (req, res) => {
  res.json(await leftoverService.getAll(req.query.location, null, req.query.food, req.query.tag, "home"));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await leftoverService.getById(req.params.id));
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const conflictDetected = await leftoverService.hasConflict(req.params.id, req.body?.lastKnownUpdatedAt);
  const item = await leftoverService.update(req.params.id, req.body);
  res.json({ message: "Leftover updated", conflictDetected, item });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await leftoverService.softDelete(req.params.id);
  res.json({ message: "Leftover deleted" });
}));

router.post("/:id/used-up", asyncHandler(async (req, res) => {
  await leftoverService.softDelete(req.params.id);
  res.json({ message: "Leftover marked used up" });
}));

router.post("/:id/restore", asyncHandler(async (req, res) => {
  const item = await leftoverService.restore(req.params.id);
  res.json({ message: "Leftover restored", item });
}));

module.exports = router;
