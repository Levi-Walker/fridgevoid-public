const createApp = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./db");
const uploadService = require("./services/uploadService");

async function start() {
  await uploadService.ensureUploadDir();
  await connectDatabase();
  const app = createApp();
  app.listen(env.port, env.host, () => {
    console.log(`FridgeVoid backend listening on http://${env.host}:${env.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
