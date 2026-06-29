const express = require("express");
const morgan = require("morgan");
const path = require("path");
const env = require("./config/env");
const corsMiddleware = require("./middleware/cors");
const errorHandler = require("./middleware/errorHandler");
const HttpError = require("./errors/HttpError");
const leftoversRouter = require("./routes/leftovers");
const locationsRouter = require("./routes/locations");
const presetsRouter = require("./routes/presets");
const scannedProductsRouter = require("./routes/scannedProducts");
const preferencesRouter = require("./routes/preferences");
const themeRouter = require("./routes/theme");
const uploadsRouter = require("./routes/uploads");
const devRouter = require("./routes/dev");

function createApp() {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json());
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }
  app.use("/uploads", express.static(path.resolve(env.uploadDir)));
  app.use("/api/uploads", express.static(path.resolve(env.uploadDir)));

  app.use("/leftovers", leftoversRouter);
  app.use("/locations", locationsRouter);
  app.use("/presets", presetsRouter);
  app.use("/scanned-products", scannedProductsRouter);
  app.use("/uploads", uploadsRouter);
  app.use("/preferences", preferencesRouter);
  app.use("/theme", themeRouter);
  app.use("/api/leftovers", leftoversRouter);
  app.use("/api/locations", locationsRouter);
  app.use("/api/presets", presetsRouter);
  app.use("/api/scanned-products", scannedProductsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/preferences", preferencesRouter);
  app.use("/api/theme", themeRouter);
  app.use("/dev", devRouter);
  app.use("/api/dev", devRouter);

  app.use((req, res, next) => {
    next(new HttpError(404, "Not Found"));
  });

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
