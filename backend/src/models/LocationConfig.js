const mongoose = require("mongoose");

const locationConfigSchema = new mongoose.Schema(
  {
    name: String,
    normalizedName: String,
    createdAt: Date,
  },
  {
    collection: "locations",
    versionKey: false,
  }
);

module.exports = mongoose.model("LocationConfig", locationConfigSchema);
