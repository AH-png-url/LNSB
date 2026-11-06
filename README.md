# LNSB

A sound-button board inspired by the supplied reference image: visitors enter a username, add and search sounds, and save personal favorites. The board owner can share the board, download sounds, remove sounds, and change the private board access code using the owner token.

Every visitor must enter the current board access code before the sound list or visitor actions are available. The access code is verified and stored as a salted scrypt hash on the server. An owner can change it from Owner controls; visitors with the old code will need the new one. Set an initial `ACCESS_CODE` secret and an `ADMIN_TOKEN` secret in the hosting environment. Access codes must be 6–128 characters.

Visitors can submit feedback or issue reports. Those messages are stored privately and are only returned by an admin-authenticated endpoint; the owner can view them in Owner controls. Feedback is not emailed automatically.

## Run locally
Requires Node.js 18+. Run `npm install`, copy `.env.example` to `.env`, set private `ADMIN_TOKEN` and `ACCESS_CODE` values, then run `npm start` and visit http://localhost:3000.

## Deploy
Deploy this Node.js app on a host with persistent storage. Set `ADMIN_TOKEN` and `ACCESS_CODE` as secret environment variables and keep `data/` and `uploads/` on a persistent disk. The app listens on the host-provided `PORT`.

Usernames and favorites are browser-local display settings, not verified accounts. Sound metadata is stored in `data/sounds.json`, uploaded files in `uploads/`, access-code hash in `data/access-code.json`, and private feedback in `data/feedback.json`. Use persistent storage to keep this data across restarts. Never store or share the admin token or access code in public source code.
