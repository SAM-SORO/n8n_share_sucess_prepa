require("dotenv").config();
const session = require("./whatsappSession");

// Script one-shot : ouvre un navigateur visible pour scanner le QR code une seule fois.
// La session est ensuite réutilisée headless par server.js via le même userDataDir.
async function main() {
  const page = await session.init({ headless: false });
  console.log("Scanne le QR code affiché dans le navigateur avec WhatsApp sur ton téléphone...");

  const loggedIn = await page
    .waitForSelector("#pane-side", { timeout: 120000 })
    .then(() => true)
    .catch(() => false);

  if (loggedIn) {
    console.log("Connecté. La session est sauvegardée, tu peux fermer ce script et lancer `npm start`.");
  } else {
    console.log("Timeout — QR non scanné dans les 2 minutes. Relance `npm run login`.");
    process.exit(1);
  }
}

main();
