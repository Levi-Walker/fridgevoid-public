const mongoose = require("mongoose");

const leftoverSchema = new mongoose.Schema(
  {
    food: String,
    expirationDate: Date,
    container: String,
    emoji: String,
    imageUrl: String,
    notes: String,
    location: String,
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date,
    tags: { type: [String], default: [] },
  },
  {
    collection: "leftovers",
    versionKey: false,
  }
);

module.exports = mongoose.model("Leftover", leftoverSchema);
