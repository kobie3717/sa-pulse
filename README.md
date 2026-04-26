# SA Pulse 🌍

Live situation awareness map for South Africa. Real-time disasters, earthquakes, wildfires, aircraft, ships, and weather — all on one map.

**Live:** [pulse.whatshubb.co.za](https://pulse.whatshubb.co.za)

## Data Sources

| Layer | Source | Key required |
|-------|--------|-------------|
| ✈ Aircraft | [OpenSky Network](https://opensky-network.org) | No |
| ⛵ Vessels | [AISStream.io](https://aisstream.io) | Free account |
| ⚠️ Disasters | [GDACS](https://gdacs.org) | No |
| 🌍 Earthquakes | [USGS](https://earthquake.usgs.gov) + [EMSC](https://seismicportal.eu) | No |
| 🔥 Wildfires / Events | [NASA EONET](https://eonet.gsfc.nasa.gov) | No |
| 🌡️ Weather | [Open-Meteo](https://open-meteo.com) | No |
| 🗺️ Province boundaries | [GADM](https://gadm.org) | No |

## Files

- `index.html` — Single-file Leaflet map (all JS inline)
- `ships.mjs` — Node.js WebSocket client for AISStream vessel tracking
- `nginx.conf` — Nginx config with API proxy routes (avoids CORS)

## Setup

### Map
Drop `index.html` into any web root. Needs nginx proxies from `nginx.conf` to avoid CORS on external APIs.

### Ship tracker
```bash
npm install ws
AISSTREAM_KEY=your_key pm2 start ships.mjs --name sapulse-ships
```
Writes vessel positions to `vessels.json` every 15s. Serve `vessels.json` from same web root as `index.html`.

### Nginx proxies
```bash
cp nginx.conf /etc/nginx/sites-available/your-domain
# Edit server_name
nginx -t && systemctl reload nginx
```

## Architecture

```
Browser → nginx proxy routes → External APIs (no CORS)
                             → /vessels.json (from ship tracker)
                             → /provinces.geojson (GADM local file)
```

Ship tracker: persistent WebSocket → aisstream.io → cache positions → `vessels.json` on disk → nginx serves → browser polls every 30s.

## Province GeoJSON

Download GADM South Africa ADM1:
```bash
wget "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_ZAF_1.json" -O provinces.geojson
```

## License

MIT
