const HttpError = require("../errors/HttpError");

const statusNames = {
  400: "Bad Request",
  404: "Not Found",
  409: "Conflict",
  410: "Gone",
  413: "Payload Too Large",
  500: "Internal Server Error",
};

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  let status = error.status || error.statusCode || 500;
  let message = error.message || "Internal Server Error";

  if (error.code === "LIMIT_FILE_SIZE") {
    status = 413;
    message = "Maximum upload size exceeded";
  }

  if (error.name === "CastError") {
    status = 404;
    message = "Not Found";
  }

  if (!(error instanceof HttpError) && status === 500) {
    message = "Internal Server Error";
  }

  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error: statusNames[status] || "Error",
    message,
    path: req.originalUrl,
  });
}

module.exports = errorHandler;
