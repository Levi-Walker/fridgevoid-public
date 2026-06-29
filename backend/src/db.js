const mongoose = require("mongoose");
const env = require("./config/env");

async function connectDatabase(uri = env.mongoUri) {
  mongoose.set("autoIndex", true);
  await mongoose.connect(uri);
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
