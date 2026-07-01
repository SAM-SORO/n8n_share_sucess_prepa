require("dotenv").config();
const express = require("express");
const session = require("./whatsappSession");
const addParticipantRoute = require("./routes/addParticipant");
const sendInviteRoute = require("./routes/sendInvite");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

// Filet de sécurité : n8n garantit déjà 1 seule requête à la fois via son verrou,
// ce mutex protège juste contre un appel manuel concurrent pendant les tests.
let busy = false;
function withMutex(handler) {
  return async (req, res) => {
    if (busy) {
      return res.status(409).json({ error: "another request is already in progress" });
    }
    busy = true;
    try {
      await handler(req, res);
    } finally {
      busy = false;
    }
  };
}

app.get("/health", async (_req, res) => {
  const status = await session.getStatus();
  res.json({ status });
});

app.post("/add-participant", withMutex(addParticipantRoute));
app.post("/send-invite", withMutex(sendInviteRoute));

session
  .init({ headless: true })
  .then(() => {
    app.listen(PORT, () => console.log(`whatsapp-bot listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to start WhatsApp session:", err);
    process.exit(1);
  });
