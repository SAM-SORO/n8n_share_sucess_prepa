const session = require("./whatsappSession");

class SessionLostError extends Error {}

const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME;

async function requireReady() {
  const { status } = session.getStatus();
  if (status !== "ready") {
    throw new SessionLostError(`WhatsApp session not ready (status: ${status})`);
  }
  return session.getClient();
}

function toWhatsappNumber(phone) {
  return phone.replace(/^\+/, "");
}

async function findGroupByName(client, groupName) {
  const chats = await client.getChats();
  return chats.find((c) => c.isGroup && c.name === groupName) || null;
}

// Codes retournés par GroupChat.addParticipants — voir whatsapp-web.js GroupParticipant docs.
function classifyAddResult(entry) {
  if (!entry) {
    return { result: "retryable", errorCode: "UNKNOWN", errorMessage: "no result entry from whatsapp-web.js" };
  }
  if (entry.code === 200 || entry.code === 409) {
    return { result: "added", errorCode: null, errorMessage: null };
  }
  if (entry.code === 404) {
    return { result: "permanent_fail", errorCode: "NOT_ON_WHATSAPP", errorMessage: entry.message || "user not on whatsapp" };
  }
  if (entry.code === 403) {
    return { result: "retryable", errorCode: "PRIVACY_RESTRICTION", errorMessage: entry.message || "privacy restriction" };
  }
  if (entry.code === 408) {
    return { result: "retryable", errorCode: "TIMEOUT", errorMessage: entry.message || "timeout adding participant" };
  }
  return { result: "retryable", errorCode: "UNKNOWN", errorMessage: entry.message || JSON.stringify(entry) };
}

async function addParticipantToGroup({ phone }) {
  const client = await requireReady();

  const numberId = await client.getNumberId(toWhatsappNumber(phone));
  if (!numberId) {
    return { result: "permanent_fail", errorCode: "NOT_ON_WHATSAPP", errorMessage: "user not on whatsapp" };
  }

  const group = await findGroupByName(client, GROUP_NAME);
  if (!group) {
    throw new Error(`WhatsApp group not found: "${GROUP_NAME}"`);
  }

  const result = await group.addParticipants([numberId._serialized]);
  const entry = result[numberId._serialized];
  return classifyAddResult(entry);
}

async function sendDirectMessage({ phone, message }) {
  const client = await requireReady();

  const numberId = await client.getNumberId(toWhatsappNumber(phone));
  if (!numberId) {
    return { result: "failed", errorCode: "NOT_ON_WHATSAPP", errorMessage: "user not on whatsapp" };
  }

  await client.sendMessage(numberId._serialized, message);
  return { result: "sent", errorCode: null, errorMessage: null };
}

module.exports = { addParticipantToGroup, sendDirectMessage, SessionLostError };
