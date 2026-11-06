# LNSB

A sound-button board inspired by the supplied reference image: visitors enter a username, add and search sounds, and save personal favorites. The board owner can share the board, download sounds, remove sounds, and change the private board access code using the private `ADMIN_TOKEN`.

Every visitor enters the current board access code before using the board. If the owner forgets that code, the home-screen **Owner? Forgot the board code?** option accepts the private admin passcode (`ADMIN_TOKEN`) and creates a short-lived, HTTP-only owner bypass cookie. Keep the admin passcode secret; never share it as the visitor code. Visitors with the old access code must enter the replacement after the owner changes it.

The access code is stored as a salted scrypt hash. Set initial `ACCESS_CODE` and `ADMIN_TOKEN` secrets in the hosting environment. Owners can change the board code from Owner controls. Access codes must be 6–128 characters.

Visitors can submit feedback or issue reports. Those messages are stored privately and only returned by an admin-authenticated endpoint. Feedback is not emailed automatically.

## Run locally
Requires Node.js 18+. Run `npm install`, copy `.env.example` to `.env`, set private `ADMIN_TOKEN` and `ACCESS_CODE` values, then run `npm start` and visit http://localhost:3000.

## Deploy
Deploy this Node.js app on a host with persistent storage. Set `ADMIN_TOKEN` and `ACCESS_CODE` as secret environment variables and keep `data/` and `uploads/` on a persistent disk. The app listens on the host-provided `PORT`.

Usernames and favorites are browser-local settings, not verified accounts. Sound metadata is stored in `data/sounds.json`, uploaded files in `uploads/`, access-code hash in `data/access-code.json`, and private feedback in `data/feedback.json`. Use persistent storage to keep this data across restarts.
