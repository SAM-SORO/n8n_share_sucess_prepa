const { sendDirectMessage, SessionLostError } = require("../groupActions");
const { isValidPhone } = require("../validatePhone");

const DEFAULT_INVITE_MESSAGE = `🎓 Bonjour chers bacheliers / futures bachelières 👋

📚 Le groupe *Success Prépa* vous accompagne dans la préparation des concours après le BAC : notamment celui de l'INPHB, l'ESATIC ... 🎯 et plusieurs autres concours

🚀 Rejoignez le groupe pour :
✔ ne rater aucune information importante
✔ recevoir les actualités des concours
✔ poser vos questions et être accompagné

🔗 Cliquez ici pour intégrer le groupe :
https://chat.whatsapp.com/GdoYnmvDIIk`;

async function sendInviteRoute(req, res) {
  const { phone, message = DEFAULT_INVITE_MESSAGE } = req.body || {};

  if (!isValidPhone(phone)) {
    return res.status(200).json({
      result: "failed",
      errorCode: "INVALID_NUMBER",
      errorMessage: "invalid phone number",
    });
  }

  try {
    const outcome = await sendDirectMessage({ phone, message });
    return res.status(200).json(outcome);
  } catch (err) {
    if (err instanceof SessionLostError) {
      return res.status(503).json({
        result: "session_lost",
        errorCode: "SESSION_LOST",
        errorMessage: err.message,
      });
    }
    return res.status(200).json({
      result: "failed",
      errorCode: "UNKNOWN",
      errorMessage: err.message,
    });
  }
}

module.exports = sendInviteRoute;
