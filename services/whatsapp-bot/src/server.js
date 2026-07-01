require("dotenv").config();
const express = require("express");
const QRCode = require("qrcode");
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

app.get("/health", (_req, res) => {
  res.json(session.getStatus());
});

app.get("/login-qr", async (_req, res) => {
  const qr = session.getLastQr();
  if (!qr) {
    return res.json(session.getStatus());
  }
  const png = await QRCode.toBuffer(qr, { type: "png", width: 300 });
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "no-store");
  res.send(png);
});

// WhatsApp Web rotates the QR every ~20-30s, so a single static image goes stale
// before a human can scan it — this page re-fetches it every few seconds instead.
app.get("/login", (_req, res) => {
  res.set("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;">
  <div style="text-align:center;">
    <img id="qr" src="/login-qr" style="width:300px;height:300px;" />
    <p id="status">Scanne avec WhatsApp (l'image se rafraîchit automatiquement)</p>
  </div>
  <script>
    setInterval(async () => {
      document.getElementById('qr').src = '/login-qr?t=' + Date.now();
      const r = await fetch('/health');
      const j = await r.json();
      document.getElementById('status').innerText = 'Statut: ' + j.status;
    }, 4000);
  </script>
</body></html>`);
});

app.get("/debug/groups", async (_req, res) => {
  try {
    const client = await session.getClient();
    const chats = await client.getChats();
    const groups = chats.filter((c) => c.isGroup).map((c) => ({ id: c.id._serialized, name: c.name }));
    res.json({ configuredGroupName: process.env.WHATSAPP_GROUP_NAME, groups });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.post("/add-participant", withMutex(addParticipantRoute));
app.post("/send-invite", withMutex(sendInviteRoute));

app.listen(PORT, () => console.log(`whatsapp-bot listening on :${PORT}`));

session.init().catch((err) => {
  console.error("Failed to start WhatsApp session:", err);
});
