const mongoose = require("mongoose");

const scannedProductSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    name: String,
    createdAt: Date,
    updatedAt: Date,
  },
  {
    collection: "scanned_products",
    versionKey: false,
  }
);

module.exports = mongoose.model("ScannedProduct", scannedProductSchema);
