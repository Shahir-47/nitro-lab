# nitro-lab

The public status page for my home server, live at **[lab.shahirahmed.com](https://lab.shahirahmed.com)**.

My old Acer Nitro 5 gaming laptop runs Ubuntu Server with the lid closed. It hosts the backends for my personal projects and a handful of self-hosted apps I keep for my own use. This page is how I explain that setup to people, and it does it with the server's own numbers: CPU, temperatures, memory, disks, GPU and the state of all 27 containers, read off the machine while you have the tab open.

![The top of the page, with the live badge in the header and the current uptime and container count](docs/overview.png)

## What the page shows

The main thing is a diagram of the whole system, from a visitor's browser to the containers and back out to the cloud services some of the apps depend on. The colored stripe down the left edge of a box is that container's real Docker state, so the drawing and the machine can't quietly drift apart.

![The architecture diagram, showing Cloudflare and the tunnel on the left, the containers grouped by app in the middle, and S3, SQS, Supabase and Spotify on the right](docs/architecture.png)

Hovering, tapping or tabbing to a box opens its details: what it does, the image it runs, the port it listens on, and how long it has been up.

![The Traefik box hovered, with a tooltip reading "Up 2 hours (healthy), traefik:v3.6, port 80"](docs/architecture-hover.png)

Under that are ten minutes of charts. They keep filling in as you read, and they already have history when the page loads, because the sampler starts with the server rather than with the first visitor.

![Five charts for CPU, CPU temperature, memory, GPU temperature and GPU load, with usage bars for memory, VRAM and both drives underneath](docs/metrics.png)

Each project also gets its own small diagram, so you can see where a single request actually goes.

![The GrabPic diagram: a Next.js frontend hosted elsewhere, Spring Boot, Redis, a face worker and an AI search service on the home server, and S3, SQS and Supabase in the cloud](docs/project-grabpic.png)

<details>
<summary>And the full container inventory, with live status</summary>

![A table of all 27 containers grouped by app, with image, port, access level and status](docs/inventory.png)

</details>

## How the live data works

One sampler runs for the whole server, and browsers only listen to it. Fifty open tabs cost the same as one.

It ticks every two seconds for the cheap readings: CPU percentage from `os.cpus()` deltas, load average, memory, uptime, and CPU package temperature straight out of `/sys/class/hwmon` (the `coretemp` driver on this Intel chip, falling back to the `x86_pkg_temp` thermal zone). Every fifth tick it also does the expensive ones: `statfs` on the two drives, `nvidia-smi` for the GPU, and a container listing from Docker. Every thirtieth tick it pulls 24-hour uptime percentages from a public Uptime Kuma status page. The last 300 samples, ten minutes, stay in memory for the charts.

[`instrumentation.js`](instrumentation.js) starts that loop when Next.js boots, and the state lives on `globalThis` so the instrumentation hook and the route handlers share one timer even if they end up with separate copies of the module.

Readings reach the browser over Server-Sent Events from [`app/api/stream/route.js`](app/api/stream/route.js). New connections get the stored history first, then every sample as it happens. The stream opens with 2 KB of padding so proxies that buffer small responses start flushing, sends a comment line every 20 seconds so idle connections aren't dropped, and stops at 200 concurrent clients. Nothing on the page polls or refreshes.

There is also a plain JSON snapshot at [`/api/status`](https://lab.shahirahmed.com/api/status), which is what I use when I want to check something from a terminal:

```console
$ curl -s https://lab.shahirahmed.com/api/status | jq '{cpuPct, cpuTemp, gpu: .gpu.temp, up: .uptime}'
{
  "cpuPct": 1,
  "cpuTemp": 57,
  "gpu": 53,
  "up": 5694.03
}
```

## What this page is allowed to see

It's a public page reading from a machine in my apartment, so the reach is cut down at every step.

It never touches the Docker socket. [`docker-compose.yml`](docker-compose.yml) puts [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) in front of it with `CONTAINERS=1` and `POST=0`, which allows reads of `/containers` and nothing else. No start, no stop, no exec, no image or volume endpoints.

Of what comes back, only containers listed in [`lib/site.js`](lib/site.js) are reported. Anything else on the host is dropped on the server, so its name and status never leave the machine. The two drives are mounted read-only and only get `statfs` called on them, which returns free space and nothing about the files.

The container also runs as a non-root user, and the site itself is reachable only through the Cloudflare Tunnel. My router has no ports forwarded.

## Running it

```sh
npm install
npm run dev
```

Locally you'll get real CPU, memory and disk readings from whatever machine you're on, and the page says as much: without `DOCKER_PROXY_URL` set there's no container data, so it shows a "local preview" notice instead of pretending.

For the real thing, `docker compose up -d` brings up the app and the socket proxy together. Three variables configure it:

| Variable | What it's for |
| --- | --- |
| `DOCKER_PROXY_URL` | Base URL of the socket proxy, e.g. `http://docker-proxy:2375`. Leave it unset and container status is simply absent. |
| `UPTIME_KUMA_URL` | Base URL of an Uptime Kuma instance. |
| `UPTIME_KUMA_SLUG` | The slug of a public status page on it. |

Two more things are environment-specific. The drive paths in [`lib/sampler.js`](lib/sampler.js) are mounted from `/data` and `/mnt/storage` on my host, and the GPU block only works if the NVIDIA Container Toolkit is installed and the container gets `NVIDIA_DRIVER_CAPABILITIES=utility`, which is what makes `nvidia-smi` available inside it. Both are safe to drop: missing mounts and a missing `nvidia-smi` are caught, and the page just doesn't draw those cards.

On my server this is deployed by Coolify from a push to `main`, and served through Traefik like everything else on the box.

## The code

Next.js 16 on the App Router, React 19, plain JavaScript, no TypeScript and no CSS framework. The only dependency beyond React and Next is `lucide-react` for the icons. The page renders on the server; the components below are client-side only where they need live data or hover state.

```
lib/site.js                   all page content, and the container allowlist
lib/sampler.js                the shared sampling loop
instrumentation.js            starts the loop when the server boots
app/page.js                   the page
app/api/stream/route.js       SSE stream
app/api/status/route.js       JSON snapshot
components/Live.js            EventSource client and formatting helpers
components/SystemMap.js       the architecture diagram
components/ProjectDiagram.js  per-project diagrams
components/Charts.js          charts and usage bars
components/LiveBits.js        live badge, vitals, inventory table
components/Tooltip.js         the hover card both diagrams share
```

Both diagrams are hand-placed SVG on a fixed viewBox, not a layout engine. It's more tedious to move a box, but the result is exactly what I drew and it scales cleanly.

## Changing what's on the page

Everything readable lives in [`lib/site.js`](lib/site.js): the projects, the self-hosted apps, the platform containers, the hardware list and the step-by-step walkthrough. Adding a container means adding an entry there and giving it a `match`, which is how a row gets tied to a real container:

```js
{ label: "Queue Up PostgreSQL", match: "queueup-postgres", image: "postgres:17", port: "5432", access: "internal" }
```

Fixed names match in full. Apps deployed by Coolify are named like `agyagczkxvu3adrftdtpkfnz-020141617359`, where the first part is the app's Coolify ID and the suffix changes on every deploy, so those match on the 24-character ID alone. `access` picks the color: `public` through Cloudflare, `private` over Tailscale, `internal` for containers with no published ports, `host` for services running outside Docker, `external` for anything off the machine.

The diagrams are separate. If you add something that should appear in the architecture drawing, it needs a node and coordinates in [`components/SystemMap.js`](components/SystemMap.js) too.

## Why bother

The whole thing costs about a dollar a month in electricity. Renting the same CPU, RAM, GPU and storage would be closer to a hundred. The trade is that I'm the one on call, which is most of the reason this page exists.
