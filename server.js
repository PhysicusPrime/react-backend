const fs = require('fs');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const Rcon = require('rcon');

const app = express();
const PORT = 3001;

// Pfad zum Log
const LOG_FILE = '/home/pzserver/Zomboid/server-console.txt';

// RCON Config
const RCON_HOST = '127.0.0.1';
const RCON_PORT = 27015;
const RCON_PASSWORD = 'x3pc092201';

// WebSocket-Server für Live-Log
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// RCON-Client
let rcon = new Rcon(RCON_HOST, RCON_PORT, RCON_PASSWORD);

rcon.on('auth', () => console.log('RCON: Auth erfolgreich'));
rcon.on('response', (str) => console.log('RCON response:', str));
rcon.on('error', (err) => console.error('RCON error:', err));
rcon.connect();

// WebSocket-Verbindung
wss.on('connection', ws => {
    console.log('Frontend verbunden');

    // Neue RCON-Kommandos vom Frontend
    ws.on('message', msg => {
        const { command } = JSON.parse(msg);
        if(command && rcon) {
            rcon.send(command);
        }
    });

    // Beim Verbinden aktuelle Log-Datei senden
    fs.readFile(LOG_FILE, 'utf8', (err, data) => {
        if(!err) ws.send(JSON.stringify({ log: data }));
    });
});

// File Tail für Live-Updates
fs.watchFile(LOG_FILE, { interval: 1000 }, (curr, prev) => {
    fs.readFile(LOG_FILE, 'utf8', (err, data) => {
        if(err) return;
        // sende nur neue Zeilen
        wss.clients.forEach(client => {
            if(client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ log: data }));
            }
        });
    });
});

// Express-Endpunkt optional
app.get('/status', (req, res) => {
    res.json({ status: 'ok' });
});

server.listen(PORT, () => {
    console.log(`Backend läuft auf http://localhost:${PORT}`);
});
