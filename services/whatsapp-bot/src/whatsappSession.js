const path = require("path");
const { chromium } = require("playwright");

const USER_DATA_DIR = path.resolve(
  process.env.WHATSAPP_USER_DATA_DIR || "./user-data"
);

let context = null;
let page = null;
let starting = null;

async function isLoggedIn(p) {
  try {
    await p.waitForSelector("#pane-side", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function launch({ headless }) {
  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless,
    viewport: { width: 1280, height: 900 },
  });
  page = context.pages()[0] || (await context.newPage());
  await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" });
  return page;
}

// Le contexte persistant (userDataDir) garde la session WhatsApp Web connectée
// entre les redémarrages du service, pour éviter de rescanner un QR à chaque cycle.
async function init({ headless = true } = {}) {
  if (starting) return starting;
  starting = launch({ headless });
  return starting;
}

async function getPage() {
  if (!page) {
    throw new Error("WhatsApp session not initialized — call init() first");
  }
  return page;
}

async function getStatus() {
  if (!page) return "starting";
  const loggedIn = await isLoggedIn(page);
  return loggedIn ? "ready" : "not_logged_in";
}

module.exports = { init, getPage, getStatus, isLoggedIn };
