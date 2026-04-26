/**
 * SA Pulse — Ship tracker
 * WebSocket to aisstream.io → cache positions to vessels.json
 * Run: pm2 start sapulse-ships.mjs --name sapulse-ships
 */

import { createWriteStream, writeFileSync } from 'fs';
import { WebSocket } from 'ws';

const API_KEY = process.env.AISSTREAM_KEY || '';
const OUTPUT = '/var/www/sapulse/vessels.json';
const BBOX  = [[-37, 12], [-17, 42]]; // SA + East Africa coast bbox [[min_lat,min_lon],[max_lat,max_lon]]
const MAX_VESSELS = 500;
const STALE_MS    = 10 * 60 * 1000; // drop vessels not seen in 10min

if (!API_KEY) {
    console.error('AISSTREAM_KEY not set. Set via: pm2 start sapulse-ships.mjs --env AISSTREAM_KEY=your_key');
    process.exit(1);
}

const vessels = new Map(); // mmsi → vessel object

function saveVessels() {
    const now = Date.now();
    // Drop stale
    for (const [mmsi, v] of vessels) {
        if (now - v.ts > STALE_MS) vessels.delete(mmsi);
    }
    const out = [...vessels.values()].slice(0, MAX_VESSELS);
    writeFileSync(OUTPUT, JSON.stringify({ updated: now, vessels: out }));
}

function connect() {
    console.log(`[${new Date().toISOString()}] Connecting to aisstream.io...`);
    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    ws.on('open', () => {
        console.log('Connected. Subscribing to SA bbox...');
        ws.send(JSON.stringify({
            APIKey: API_KEY,
            BoundingBoxes: [BBOX],
            FilterMessageTypes: ['PositionReport', 'ShipStaticData']
        }));
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            const mmsi = msg.MetaData?.MMSI_String || String(msg.MetaData?.MMSI || '');
            if (!mmsi) return;

            const existing = vessels.get(mmsi) || {};

            if (msg.MessageType === 'PositionReport') {
                const p = msg.Message?.PositionReport;
                if (!p) return;
                vessels.set(mmsi, {
                    ...existing,
                    mmsi,
                    lat: p.Latitude,
                    lon: p.Longitude,
                    sog: p.SpeedOverGround,   // knots
                    cog: p.CourseOverGround,  // degrees
                    hdg: p.TrueHeading,
                    name: existing.name || msg.MetaData?.ShipName?.trim() || mmsi,
                    ts: Date.now()
                });
            } else if (msg.MessageType === 'ShipStaticData') {
                const s = msg.Message?.ShipStaticData;
                if (!s) return;
                vessels.set(mmsi, {
                    ...existing,
                    mmsi,
                    name: s.Name?.trim() || existing.name || mmsi,
                    type: s.Type,
                    callsign: s.CallSign?.trim(),
                    dest: s.Destination?.trim(),
                    flag: msg.MetaData?.flag || '',
                    ts: existing.ts || Date.now()
                });
            }
        } catch (e) {
            // ignore parse errors
        }
    });

    ws.on('error', (e) => console.error('WS error:', e.message));

    ws.on('close', (code, reason) => {
        console.log(`WS closed ${code}. Reconnecting in 10s...`);
        setTimeout(connect, 10000);
    });

    // Save every 15s
    setInterval(saveVessels, 15000);
}

// Write empty file so nginx doesn't 404 on startup
writeFileSync(OUTPUT, JSON.stringify({ updated: Date.now(), vessels: [] }));

connect();
