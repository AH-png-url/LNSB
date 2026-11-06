# LNSB

A sound-button board inspired by the supplied reference image: anyone can enter a username, add sounds, search the board, and keep personal favorites. Only the board owner can share the board from its admin control, download sounds, or remove any sound—including sounds added by someone else.

## Run locally
Requires Node.js 18+. Run `npm install`, copy `.env.example` to `.env`, set a private `ADMIN_TOKEN`, then run `npm start` and visit http://localhost:3000.

## Deploy
Deploy this Node.js app on a host with persistent storage. Set `ADMIN_TOKEN` as a secret environment variable and keep `data/` and `uploads/` on a persistent disk. The app listens on the host-provided `PORT`.

Visitors are prompted for a username; it is saved in that visitor's browser and displayed next to sounds they add. Favorites are also per browser. The browser prompt is for display identity, not account authentication. Owner-only actions are verified by the server using `ADMIN_TOKEN`. Public audio playback requires public access to the audio URL; the download button itself is shown only in verified owner mode and its server route requires the admin token.
