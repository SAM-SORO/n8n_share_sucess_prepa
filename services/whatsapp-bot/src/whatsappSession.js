const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");

const USER_DATA_DIR = path.resolve(
  process.env.WHATSAPP_USER_DATA_DIR || "./user-data"
);

let client = null;
let status = "starting";
let lastQr = null;
let lastError = null;

function build() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: USER_DATA_DIR }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    status = "qr";
    lastQr = qr;
  });
  client.on("ready", () => {
    status = "ready";
    lastQr = null;
  });
  client.on("authenticated", () => {
    status = "authenticated";
  });
  client.on("auth_failure", (msg) => {
    status = "auth_failure";
    lastError = msg;
  });
  client.on("disconnected", (reason) => {
    status = "disconnected";
    lastError = reason;
  });

  return client;
}

// whatsapp-web.js (Puppeteer sous le capot) embarque les contournements nécessaires
// pour passer l'étape de liaison d'appareil — un Playwright "nu" se faisait bloquer
// par la détection anti-bot de WhatsApp à cette étape, même avec un user-agent réaliste.
async function init() {
  if (client) return client;
  build();
  await client.initialize();
  return client;
}

async function getClient() {
  if (!client) {
    throw new Error("WhatsApp session not initialized — call init() first");
  }
  return client;
}

function getStatus() {
  return { status, lastError };
}

function getLastQr() {
  return lastQr;
}

module.exports = { init, getClient, getStatus, getLastQr };
