# Projet

Automatisation de l'intégration d'étudiants dans un groupe WhatsApp via n8n + Supabase + Playwright.

---

# Technologies

- n8n (orchestration)
- Supabase (source de vérité)
- Playwright (automatisation WhatsApp Web)
- WhatsApp Web

---

# Base de données (Supabase)

Table : students

## Colonnes

- id
- nom
- telephone
- group_id
- whatsapp_status
- attempt_count
- last_attempt_at
- next_retry_at
- last_error

---

# 🔥 États possibles (TRÈS IMPORTANT)

La colonne `whatsapp_status` doit suivre STRICTEMENT ces valeurs :

## 1. pending
➡️ Étudiant pas encore traité

## 2. processing
➡️ Étudiant actuellement en cours de traitement (évite doublons)

## 3. added
➡️ Étudiant ajouté avec succès au groupe WhatsApp
⚠️ Depuis le 2026-07-02 : plus utilisé en pratique (voir section "Stratégie d'envoi" plus bas) — l'ajout automatique au groupe a été abandonné au profit de l'envoi systématique du lien d'invitation, jugé trop détectable par WhatsApp. Conservé dans le schéma pour compatibilité avec l'historique.

## 4. invited
➡️ Lien d'invitation envoyé (chemin normal désormais, pas seulement un fallback)

## 5. failed
➡️ Échec définitif (numéro invalide, erreur critique)

## 6. skipped
➡️ Ignoré volontairement (ex: limite journalière atteinte)

---


## Champs de suivi (logique métier)

### whatsapp_status
➡️ Statut actuel de l'étudiant dans le workflow.

Valeurs possibles :
- pending → pas encore traité
- processing → en cours de traitement
- added → ajouté au groupe avec succès
- invited → ajout impossible, lien envoyé
- failed → erreur critique (numéro invalide, problème technique)
- skipped → ignoré (limite journalière ou arrêt volontaire)

👉 Rôle :
Permet de savoir exactement où en est chaque étudiant dans le pipeline.

---

### attempt_count
➡️ Nombre total de tentatives effectuées sur cet étudiant.

👉 Rôle :
- éviter les boucles infinies
- limiter les retries
- analyser les taux d’échec

Recommandation réaliste
Tentative 1 : ajout au groupe
Tentative 2 : retry plus tard (si échec temporaire)
Puis arrêt définitif → invited ou failed
🧠 Pourquoi 2 tentatives suffisent

WhatsApp ne “récompense” pas les retries multiples. Au contraire :

trop de tentatives répétées = comportement suspect
échecs répétés = signal de spam potentiel
retry rapide = encore plus risqué

👉 Donc :

mieux vaut peu de tentatives intelligentes que beaucoup de tentatives agressives

---

### last_attempt_at
➡️ Date et heure de la dernière tentative (ajout ou invitation)

👉 Rôle :
- audit du workflow
- debug en cas de problème
- analyse des performances
- contrôle des délais entre actions

Exemple :
2026-07-01 10:45:00

---

### next_retry_at
➡️ Date à laquelle une nouvelle tentative est autorisée.

👉 Rôle :
- gérer les délais intelligents
- éviter les actions trop rapides
- implémenter des backoff (attente progressive)

Exemple :
- échec → next_retry_at = now() + 30 minutes

---

### last_error
➡️ Message décrivant la dernière erreur rencontrée.

👉 Rôle :
- comprendre pourquoi un ajout a échoué
- classification des erreurs
- aide au debug et monitoring

Exemples :
- "privacy restriction"
- "invalid phone number"
- "user not on WhatsApp"
- "rate limit detected"



# 🎯 Objectif du workflow

Toutes les 5 minutes :

1. sélectionner 1 étudiant avec :
   - whatsapp_status = "pending"
   - ou "invited" avec retry possible

2. vérifier qu'il n'est pas en "processing"

3. marquer en "processing"

4. attendre un délai aléatoire (3 à 6 minutes)

5. envoyer le lien d'invitation directement (pas de tentative d'ajout au groupe, voir "Stratégie d'envoi")

6. si envoi réussi :
   - whatsapp_status = "invited"

7. si échec (numéro invalide ou erreur) :
   - whatsapp_status = "failed"

8. incrémenter attempt_count
9. enregistrer last_attempt_at

---

# 📨 Stratégie d'envoi (mise à jour 2026-07-02)

**L'ajout automatique direct au groupe a été abandonné.** Constat : ajouter quelqu'un à un groupe sans son accord génère un message système visible par tout le groupe et expose la personne ajoutée à signaler le compte — un vecteur de détection/plainte plus fort qu'un simple message. Suite à plusieurs déconnexions forcées du compte WhatsApp automatisé la nuit du 2026-07-01 au 2026-07-02, décision : **on envoie systématiquement le lien d'invitation en message direct, on ne tente plus jamais l'ajout automatique au groupe.**

Ça reste sur un compte WhatsApp lié via appareil (pas l'API officielle Business — jugée trop coûteuse/complexe à mettre en place pour ce projet : nécessite un numéro dédié neuf et ne supporte de toute façon pas la gestion de groupe). Le rythme (1 seul envoi à la fois, délai aléatoire 3-6 min) reste identique — c'est justement ce rythme qui doit éviter d'être vu comme un bot de spam, même en envoi de messages directs.

**Changement de compte (2026-07-02)** : après plusieurs déconnexions forcées répétées du premier compte (y compris après un simple envoi de message unique, sans lien évident avec le volume ou le type d'action), bascule sur un second compte WhatsApp. Cap quotidien abaissé temporairement à **30/jour** (au lieu de 70) le temps de valider que ce nouveau compte tient la charge — à remonter progressivement si tout se passe bien.

**Limite connue** : l'envoi de messages non sollicités en masse est lui aussi surveillé par WhatsApp (spam de premiers contacts) — ce changement réduit le risque de détection mais ne l'élimine pas complètement.


# Message d’invitation

🎓 Bonjour chers bacheliers / futures bachelières 👋

📚 Le groupe *Success Prépa* vous accompagne dans la préparation des concours après le BAC : notamment celui de l'INPHB, l'ESATIC ... 🎯 et plusieurs autres concours

🚀 Rejoignez le groupe pour :
✔ ne rater aucune information importante
✔ recevoir les actualités des concours
✔ poser vos questions et être accompagné

🔗 Cliquez ici pour intégrer le groupe :
https://chat.whatsapp.com/GdoYnmvDIIk3cKd7bBuYwn

# 📊 Limite quotidienne

- maximum : 30 ajouts / jour (temporaire, cap de démarrage prudent pour le nouveau compte — voir "Stratégie d'envoi")

## Si limite atteinte :
- passer les étudiants restants en "skipped"
- arrêter le workflow jusqu'au lendemain

---

# ⚙️ Contraintes techniques

- 1 seul étudiant traité à la fois
- éviter les doublons (status = processing)
- délais aléatoires obligatoires
- Supabase = source unique de vérité
- workflow doit pouvoir reprendre après crash

---


# 🧠 Logique anti-doublon (CRITIQUE)

Avant traitement :

- si student.status == "processing" → ignorer
- sinon → passer en "processing"

Après traitement :

- toujours remettre un statut final (added / invited / failed)

---

# ⚠️ Risques WhatsApp

WhatsApp peut détecter :
- automatisation excessive
- répétition d’actions
- volume trop élevé

Donc :
- ne jamais dépasser 30/jour (temporaire, voir "Stratégie d'envoi")
- délais aléatoires obligatoires
- pauses longues après séries d’actions

---

# 🔁 Résumé du flux

pending → processing → invited
                     ↘ failed
                     ↘ skipped

(added : conservé dans le schéma mais plus produit par le workflow depuis le 2026-07-02, voir "Stratégie d'envoi")