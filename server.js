const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const Rcon = require('rcon');
const express = require('express');

const LOG_FILE = '/home/pzserver/Zomboid/server-console.txt';
const RCON_HOST = '127.0.0.1';
const RCON_PORT = 27015;
const RCON_PASSWORD = 'dein_rcon_passwort';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let rcon = new Rcon(RCON_HOST, RCON_PORT, RCON_PASSWORD);

rcon.on('auth', () => console.log('RCON: Auth erfolgreich'));
rcon.on('response', (str) => {
    wss.clients.forEach(client => {
        if(client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ rconResponse: str }));
        }
    });
});
rcon.on('error', (err) => console.error('RCON error:', err));
rcon.connect();

wss.on('connection', ws => {
    console.log('Frontend verbunden');

    fs.readFile(LOG_FILE, 'utf8', (err, data) => {
        if(!err) {
            const lines = data.split('\n').slice(-50).join('\n');
            ws.send(JSON.stringify({ log: lines }));
        }
    });

    ws.on('message', msg => {
        try {
            const { command } = JSON.parse(msg);
            if(command && rcon) rcon.send(command);
        } catch(e) {
            console.error('WS parsing error:', e);
        }
    });
});

// Tail-Funktion für Logfile
let lastSize = 0;
fs.stat(LOG_FILE, (err, stats) => { if(!err) lastSize = stats.size; });

setInterval(() => {
    fs.stat(LOG_FILE, (err, stats) => {
        if(err) return;
        if(stats.size > lastSize) {
            const stream = fs.createReadStream(LOG_FILE, { start: lastSize, end: stats.size });
            let chunk = '';
            stream.on('data', data => chunk += data.toString());
            stream.on('end', () => {
                wss.clients.forEach(client => {
                    if(client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ log: chunk }));
                    }
                });
            });
            lastSize = stats.size;
        }
    });
}, 1000);

app.get('/status', (req, res) => res.json({ status: 'ok' }));

server.listen(3001, () => console.log('Backend läuft auf http://localhost:3001'));
