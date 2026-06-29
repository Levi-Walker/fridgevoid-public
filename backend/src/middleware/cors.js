const cors = require("cors");
const env = require("../config/env");

function patternToRegex(pattern) {
  const portPlaceholder = "__PORT__";
  const escaped = pattern
    .replaceAll("[*]", portPlaceholder)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replaceAll(portPlaceholder, "\\d+");
  return new RegExp(`^${escaped}$`, "i");
}

const matchers = env.corsAllowedOriginPatterns.map(patternToRegex);

module.exports = cors({
  origin(origin, callback) {
    if (!origin || matchers.some((matcher) => matcher.test(origin))) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["*"],
});
