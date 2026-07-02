const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");

const USER_DATA_DIR = path.resolve(
  process.env.WHATSAPP_USER_DATA_DIR || "./user-data"
);
// whatsapp-web.js's default LocalWebCache writes to ./.wwebjs_cache, which sits
// outside the persisted volume — every redeploy loses the last-known-working
// WhatsApp Web version and re-fetches whatever WhatsApp serves live. That live
// bundle drifting out from under whatsapp-web.js's injected shims is what causes
// crashes like "findImpl is not a function". Storing the cache next to
// USER_DATA_DIR keeps the same working version pinned across restarts.
const WEB_VERSION_CACHE_DIR = path.join(
  path.dirname(USER_DATA_DIR),
  "wwebjs_cache"
);

let client = null;
let status = "starting";
let lastQr = null;
let lastError = null;

// whatsapp-web.js only reads from webVersionCache when options.webVersion is set
// explicitly — otherwise it always fetches WhatsApp's live version and merely
// writes a copy to the cache. So pinning requires us to read back the last
// version it persisted and pass it in ourselves; an empty cache (first ever boot)
// means no pin yet, so it falls through to live + persists whatever it got.
function getPinnedWebVersion() {
  if (!fs.existsSync(WEB_VERSION_CACHE_DIR)) return undefined;
  const cached = fs
    .readdirSync(WEB_VERSION_CACHE_DIR)
    .filter((f) => f.endsWith(".html"))
    .map((f) => ({
      version: f.replace(/\.html$/, ""),
      mtimeMs: fs.statSync(path.join(WEB_VERSION_CACHE_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return cached[0]?.version;
}

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
    webVersion: getPinnedWebVersion(),
    webVersionCache: { type: "local", path: WEB_VERSION_CACHE_DIR },
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
