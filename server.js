const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static(__dirname));

app.get('/pair', async (req, res) => {
    let num = req.query.number ? req.query.number.replace(/[^0-9]/g, '') : '';
    if (!num) return res.status(400).send({ error: "Number is required" });

    const sessionDir = path.join(__dirname, `./temp_${Date.now()}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    try {
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"], // Emulate standard Linux web connection
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000
        });

        sock.ev.on('creds.update', saveCreds);

        // Wait for socket initialization
        await delay(3000);

        if (!sock.authState.creds.registered) {
            const code = await sock.requestPairingCode(num);
            res.send({ code: code?.match(/.{1,4}/g)?.join("-") || code });
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                await delay(3000);
                const credsFile = path.join(sessionDir, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    const credsData = fs.readFileSync(credsFile);
                    const sessionString = Buffer.from(credsData).toString('base64');
                    const sessionId = `PrimeBot~${sessionString}`;

                    await sock.sendMessage(`${num}@s.whatsapp.net`, {
                        text: `*PRIME BOT SESSION ID*\n\nHere is your Session ID. Copy it to deploy your bot:\n\n\`\`\`${sessionId}\`\`\`\n\n⚠️ Keep this private!`
                    });
                }
                await delay(2000);
                sock.ws.close();
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        });

    } catch (e) {
        if (!res.headersSent) res.status(500).send({ error: "Failed to generate pairing code." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pairing server running on port ${PORT}`));
