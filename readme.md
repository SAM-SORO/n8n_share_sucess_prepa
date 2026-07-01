Dockerfile créé (services/whatsapp-bot/Dockerfile, basé sur l'image officielle mcr.microsoft.com/playwright:v1.47.0-jammy). Je n'ai pas pu valider le build localement — Docker Desktop n'est pas lancé sur cette machine. Dis-moi si tu veux que je te guide pour le démarrer et retester, ou si tu valideras le build toi-même.

Point important sur le déploiement : WhatsApp Web nécessite de scanner un QR code une seule fois pour créer la session. Un conteneur Coolify n'a pas d'écran, donc le flux sera :

Tu lances npm run login en local sur cette machine (navigateur visible, tu scannes le QR une fois) → ça crée services/whatsapp-bot/user-data/
On synchronise ce dossier vers un volume persistant Coolify attaché au service déployé
Le service tourne ensuite headless sur Coolify en réutilisant cette session

#etape que j'ai eu a suivre pour le déploiement sur Coolify

Étape 2 — Créer le service sur Coolify
Dans ton dashboard Coolify :

New Resource → Application → Git-based → Public/Private Repository (choisis selon la visibilité de n8n_share_sucess_prepa)
Repository URL : https://github.com/SAM-SORO/n8n_share_sucess_prepa.git, branche main
Base directory (chemin racine à builder) : /services/whatsapp-bot
Build pack : Dockerfile (il est déjà à services/whatsapp-bot/Dockerfile)
Port : 3001
Étape 3 — Variables d'environnement du service
PORT=3001 (déjà en défaut dans le Dockerfile, optionnel)
WHATSAPP_USER_DATA_DIR=/data/user-data (déjà en défaut, optionnel)
WHATSAPP_GROUP_NAME=(1)Prepa : Concours INP-HB, ESATIC .....
Étape 4 — Volume persistant (critique)
Sans ça, chaque redéploiement effacerait la session WhatsApp Web et il faudrait rescanner le QR. Dans Coolify, ajoute un Persistent Volume :

Pour ce formulaire :

Name : whatsapp-bot-data ✓ (déjà bon)
Source Path : laisse vide — c'est pour un bind-mount vers un chemin spécifique de l'hôte Coolify, on n'en a pas besoin. Coolify gère le stockage lui-même avec un volume nommé.
Destination Path : /data
Pour le port : remplace le 3000 par défaut par 3001, puisque c'est le port sur lequel le service écoute réellement (EXPOSE 3001 dans le Dockerfile, PORT=3001)


Déployer/redéployer le service sur Coolify (il va récupérer ce dernier commit)
Une fois déployé, ouvre https://<ton-domaine-coolify>/login-qr directement dans ton navigateur
Scanne le QR affiché avec WhatsApp sur ton téléphone (Paramètres → Appareils connectés → Connecter un appareil)
Vérifie ensuite https://<ton-domaine-coolify>/health → devrait afficher {"status":"ready"}