Dockerfile créé (services/whatsapp-bot/Dockerfile, basé sur l'image officielle mcr.microsoft.com/playwright:v1.47.0-jammy). Je n'ai pas pu valider le build localement — Docker Desktop n'est pas lancé sur cette machine. Dis-moi si tu veux que je te guide pour le démarrer et retester, ou si tu valideras le build toi-même.

Point important sur le déploiement : WhatsApp Web nécessite de scanner un QR code une seule fois pour créer la session. Un conteneur Coolify n'a pas d'écran, donc le flux sera :

Tu lances npm run login en local sur cette machine (navigateur visible, tu scannes le QR une fois) → ça crée services/whatsapp-bot/user-data/
On synchronise ce dossier vers un volume persistant Coolify attaché au service déployé
Le service tourne ensuite headless sur Coolify en réutilisant cette session