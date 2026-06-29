const mongoose = require("mongoose");

const householdPreferencesSchema = new mongoose.Schema(
  {
    _id: String,
    statusLabels: { type: Map, of: String, default: {} },
    statusOrder: { type: [String], default: [] },
    theme: { type: Map, of: String, default: {} },
    defaultCardImageMode: String,
    defaultQuickAddLocation: String,
    compactCardMode: Boolean,
    createdAt: Date,
    updatedAt: Date,
  },
  {
    collection: "preferences",
    versionKey: false,
  }
);

module.exports = mongoose.model("HouseholdPreferences", householdPreferencesSchema);
