# LNSB

A sound-button board inspired by the supplied reference image: visitors enter a username, add and search sounds, and save personal favorites. The board owner can share the board, download sounds, remove sounds, and manage its secret access code using the private `ADMIN_TOKEN`.

Each visitor enters the board code once per browser. The server exchanges it for a persistent, HttpOnly access cookie; the plaintext code is not saved in browser storage. The owner can use the admin passcode on the entry screen if the visitor code is forgotten. In Owner controls, **Reset all access sessions** keeps the current code but invalidates every visitor cookie, so everyone must enter the code again. Changing the code also resets all sessions. Set `ACCESS_CODE` and `ADMIN_TOKEN` as secrets in the hosting environment.

Nicknames are claimed server-side and unique regardless of capitalization or extra spaces. A private random claim key is held by that browser and checked for sound uploads and feedback. Clearing browser storage may lose access to the claimed nickname; nicknames are not verified identities.

Feedback and issue reports are private and only returned by an admin-authenticated endpoint. They are not emailed automatically.

## Run locally
Requires Node.js 18+. Run `npm install`, copy `.env.example` to `.env`, set private `ADMIN_TOKEN` and `ACCESS_CODE` values, then run `npm start` and visit http://localhost:3000.

## Deploy
Deploy on a Node.js host with persistent storage. Set `ADMIN_TOKEN` and `ACCESS_CODE` as environment secrets and keep `data/` and `uploads/` on a persistent disk. The app listens on the host-provided `PORT`.

Sound metadata is stored in `data/sounds.json`, uploads in `uploads/`, access-code/session hashes in `data/access-code.json`, nickname claims in `data/nicknames.json`, and private feedback in `data/feedback.json`. Persistent storage is required across restarts.
