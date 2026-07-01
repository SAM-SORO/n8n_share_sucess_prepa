const session = require("./whatsappSession");

class SessionLostError extends Error {}

// Sélecteurs "best effort" — à recalibrer contre l'UI réelle de WhatsApp Web
// (le DOM change dans le temps et selon la langue de l'interface).
const SEARCH_BOX = 'div[contenteditable="true"][data-tab="3"], [aria-label="Search input textbox"]';
const PRIVACY_DIALOG_TEXT = /privacy|confidentialit/i;
const NOT_ON_WHATSAPP_TEXT = /not on whatsapp|n'utilise pas whatsapp|pas sur whatsapp/i;
const ADD_PARTICIPANT_TEXT = /add participant|ajouter.*participant/i;

async function requireLoggedIn(page) {
  if (!(await session.isLoggedIn(page))) {
    throw new SessionLostError("WhatsApp Web session is not logged in");
  }
}

async function openGroup(page, groupName) {
  const searchBox = page.locator(SEARCH_BOX).first();
  await searchBox.click();
  await searchBox.fill(groupName);
  await page.waitForTimeout(800);
  await page.getByText(groupName, { exact: false }).first().click({ timeout: 10000 });
}

async function addParticipantToGroup({ groupName, phone }) {
  const page = await session.getPage();
  await requireLoggedIn(page);

  await openGroup(page, groupName);

  // Ouvre les infos du groupe puis le dialogue d'ajout de participant
  await page.locator("header").getByText(groupName, { exact: false }).click();
  await page
    .getByText(ADD_PARTICIPANT_TEXT)
    .first()
    .click({ timeout: 10000 });

  const participantSearch = page.locator(SEARCH_BOX).last();
  await participantSearch.fill(phone);
  await page.waitForTimeout(1500);

  const notOnWhatsapp = await page
    .getByText(NOT_ON_WHATSAPP_TEXT)
    .first()
    .isVisible()
    .catch(() => false);
  if (notOnWhatsapp) {
    return { result: "permanent_fail", errorCode: "NOT_ON_WHATSAPP", errorMessage: "user not on whatsapp" };
  }

  const contactResult = page.locator(`span[title="${phone}"], span:has-text("${phone}")`).first();
  const found = await contactResult.isVisible().catch(() => false);
  if (!found) {
    return { result: "retryable", errorCode: "TIMEOUT", errorMessage: "contact not found in add-participant search" };
  }

  await contactResult.click();
  await page.getByRole("button", { name: /add|ajouter/i }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1500);

  const privacyBlocked = await page
    .getByText(PRIVACY_DIALOG_TEXT)
    .first()
    .isVisible()
    .catch(() => false);
  if (privacyBlocked) {
    return {
      result: "retryable",
      errorCode: "PRIVACY_RESTRICTION",
      errorMessage: "privacy restriction",
    };
  }

  return { result: "added", errorCode: null, errorMessage: null };
}

async function sendDirectMessage({ phone, message }) {
  const page = await session.getPage();
  await requireLoggedIn(page);

  await page.goto(
    `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`,
    { waitUntil: "domcontentloaded" }
  );

  const notOnWhatsapp = await page
    .getByText(NOT_ON_WHATSAPP_TEXT)
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  if (notOnWhatsapp) {
    return { result: "failed", errorCode: "NOT_ON_WHATSAPP", errorMessage: "user not on whatsapp" };
  }

  const sendButton = page.getByRole("button", { name: /send/i }).first();
  await sendButton.click({ timeout: 10000 });

  return { result: "sent", errorCode: null, errorMessage: null };
}

module.exports = { addParticipantToGroup, sendDirectMessage, SessionLostError };
