# LNSB

A shareable sound board: anyone with its URL can add audio and search the collection. Favorites are saved per browser. Only the board owner, authenticated with the private `ADMIN_TOKEN`, can remove any sound—including sounds added by someone else.

## Run locally

Requires Node.js 18+. Run `npm install`, copy `.env.example` to `.env`, choose a private `ADMIN_TOKEN`, then run `npm start` and visit http://localhost:3000.

## Deploy

Deploy this Node.js app to a host that supports persistent disk storage (for example Render). Set `ADMIN_TOKEN` as a secret environment variable. Keep `data/` and `uploads/` on a persistent disk or added sounds will be lost on restart. The app listens on the `PORT` provided by your host.
