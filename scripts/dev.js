const { spawn } = require("node:child_process");

const isWindows = process.platform === "win32";

const processes = [
  {
    name: "backend",
    color: "\x1b[36m",
    args: ["--prefix", "backend", "run", "dev"],
  },
  {
    name: "frontend",
    color: "\x1b[35m",
    args: ["--prefix", "frontend", "run", "dev"],
    env: {
      FRONTEND_HOST: "localhost",
    },
  },
];

const reset = "\x1b[0m";
const children = new Set();
let shuttingDown = false;

function log(name, color, message) {
  process.stdout.write(`${color}[${name}]${reset} ${message}`);
}

function startProcess({ name, color, args, env = {} }) {
  const command = isWindows ? "cmd.exe" : "npm";
  const commandArgs = isWindows
    ? ["/d", "/s", "/c", `npm ${args.join(" ")}`]
    : args;

  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  });

  children.add(child);

  child.stdout.on("data", (data) => log(name, color, data));
  child.stderr.on("data", (data) => log(name, color, data));

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`\n${name} exited with ${reason}. Stopping dev servers...`);
    stopAll(code || 1);
  });
}

function stopAll(exitCode = 0) {
  shuttingDown = true;

  for (const child of children) {
    if (isWindows) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: false,
      });
    } else {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 300);
}

console.log("Starting FridgeVoid...");
console.log("Backend will start MongoDB automatically, then the API.");
console.log("Frontend will start the Vite dev server.\n");

processes.forEach(startProcess);

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
