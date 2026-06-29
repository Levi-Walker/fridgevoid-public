const mongoose = require("mongoose");

const presetSchema = new mongoose.Schema(
  {
    name: String,
    shelfLifeDays: Number,
    container: String,
    emoji: String,
    imageUrl: String,
    createdAt: Date,
    updatedAt: Date,
    usedCount: Number,
    tags: { type: [String], default: [] },
  },
  {
    collection: "presets",
    versionKey: false,
  }
);

module.exports = mongoose.model("Preset", presetSchema);
