const express = require("express");
const multer = require("multer");
const asyncHandler = require("../middleware/asyncHandler");
const env = require("../config/env");
const uploadService = require("../services/uploadService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeBytes },
});

router.post("/", upload.single("file"), asyncHandler(async (req, res) => {
  res.json({ imageUrl: await uploadService.store(req.file) });
}));

module.exports = router;
