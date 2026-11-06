# LNSB

A sound-button board inspired by the supplied reference image: visitors enter a username, add and search sounds, and save personal favorites. The board owner can share the board, download sounds, remove sounds, and change the private board access code using the private `ADMIN_TOKEN`.

Every visitor enters the current board access code before using the board. The owner can use the admin passcode on the entry screen if they forget the visitor code. The access code is stored as a salted scrypt hash. Set initial `ACCESS_CODE` and `ADMIN_TOKEN` secrets in the hosting environment. Owners can change the board code from Owner controls. Access codes must be 6–128 characters.

Nicknames are claimed server-side and are unique regardless of capitalization or extra spaces. A private random claim key is stored in that browser and checked by the server when adding sounds or sending feedback. This prevents accidental duplicate nicknames, but it is not a full account system: clearing browser storage means the person may lose access to that nickname. Do not treat nicknames as verified identities.

Visitors can submit feedback or issue reports. Those messages are stored privately and only returned by an admin-authenticated endpoint. Feedback is not emailed automatically.

## Run locally
Requires Node.js 18+. Run `npm install`, copy `.env.example` to `.env`, set private `ADMIN_TOKEN` and `ACCESS_CODE` values, then run `npm start` and visit http://localhost:3000.

## Deploy
Deploy this Node.js app on a host with persistent storage. Set `ADMIN_TOKEN` and `ACCESS_CODE` as secret environment variables and keep `data/` and `uploads/` on a persistent disk. The app listens on the host-provided `PORT`.

Usernames and favorites are browser-local settings. Sound metadata is stored in `data/sounds.json`, uploaded files in `uploads/`, access-code hash in `data/access-code.json`, nickname claims in `data/nicknames.json`, and private feedback in `data/feedback.json`. Use persistent storage to keep this data across restarts.
