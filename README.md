# nitro-lab

Public page for my home server. Next.js (App Router), plain JavaScript.

- `lib/site.js` holds all the content and the container allowlist
- `lib/sampler.js` reads the host, the Docker API and Uptime Kuma, only while someone has the page open
- `app/api/stream/route.js` streams readings to the browser with Server-Sent Events
- `app/api/status/route.js` returns one JSON snapshot
- `components/Live.js` is the client side

Only containers listed in `lib/site.js` are ever reported.

Local: `npm install && npm run dev`
