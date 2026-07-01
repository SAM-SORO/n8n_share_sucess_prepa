const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");

const USER_DATA_DIR = path.resolve(
  process.env.WHATSAPP_USER_DATA_DIR || "./user-data"
);

let client = null;
let status = "starting";
let lastQr = null;
let lastError = null;

// Un arrêt brutal du conteneur (crash, redéploiement) laisse le fichier de verrou
// Chromium dans le profil persistant, qui bloque ensuite tout redémarrage en pensant
// qu'une autre instance l'utilise. Il n'y a jamais qu'une seule instance de ce service,
// donc ce verrou est toujours périmé au démarrage — on le supprime avant de lancer.
function clearStaleChromeLocks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      clearStaleChromeLocks(full);
    } else if (/^Singleton(Lock|Cookie|Socket)$/.test(entry.name)) {
      try {
        fs.unlinkSync(full);
      } catch {
        // already gone, fine
      }
    }
  }
}

function build() {
  clearStaleChromeLocks(USER_DATA_DIR);

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: USER_DATA_DIR }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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
