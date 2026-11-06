# LNSB

A sound-button board inspired by the supplied reference image: visitors enter a username, add and search sounds, and save personal favorites. The board owner can share the board, download sounds, and remove sounds using the private `ADMIN_TOKEN`.

Visitors can also submit feedback or issue reports. Those messages are stored privately and are only returned by an admin-authenticated endpoint; the owner can view them in the Owner controls menu after verifying the admin token. Feedback is not emailed automatically.

## Run locally
Requires Node.js 18+. Run `npm install`, copy `.env.example` to `.env`, set a private `ADMIN_TOKEN`, then run `npm start` and visit http://localhost:3000.

## Deploy
Deploy this Node.js app on a host with persistent storage. Set `ADMIN_TOKEN` as a secret environment variable and keep `data/` and `uploads/` on a persistent disk. The app listens on the host-provided `PORT`.

Usernames and favorites are browser-local display settings, not verified accounts. Sound metadata is stored in `data/sounds.json`, uploaded files in `uploads/`, and private feedback in `data/feedback.json`. Use persistent storage to keep this data across restarts.
