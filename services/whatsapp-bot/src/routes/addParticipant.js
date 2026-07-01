const { addParticipantToGroup, SessionLostError } = require("../groupActions");
const { isValidPhone } = require("../validatePhone");

const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME;

async function addParticipantRoute(req, res) {
  const { phone } = req.body || {};

  if (!isValidPhone(phone)) {
    return res.status(200).json({
      result: "permanent_fail",
      errorCode: "INVALID_NUMBER",
      errorMessage: "invalid phone number",
      durationMs: 0,
    });
  }

  const startedAt = Date.now();
  try {
    const outcome = await addParticipantToGroup({ groupName: GROUP_NAME, phone });
    return res.status(200).json({ ...outcome, durationMs: Date.now() - startedAt });
  } catch (err) {
    if (err instanceof SessionLostError) {
      return res.status(503).json({
        result: "session_lost",
        errorCode: "SESSION_LOST",
        errorMessage: err.message,
        durationMs: Date.now() - startedAt,
      });
    }
    return res.status(200).json({
      result: "retryable",
      errorCode: "UNKNOWN",
      errorMessage: err.message,
      durationMs: Date.now() - startedAt,
    });
  }
}

module.exports = addParticipantRoute;
