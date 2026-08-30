const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.static(__dirname));

app.get('/pair', async (req, res) => {
    let num = req.query.number ? req.query.number.replace(/[^0-9]/g, '') : '';
    if (!num) return res.status(400).send({ error: "Number required" });

    const sessionDir = path.join(__dirname, `./temp_${Date.now()}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    try {
        // Fetch the latest version configuration from Baileys
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            auth: state,
            version,
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }),
            // Configures standard browser signature recognized by WhatsApp
            browser: Browsers.macOS("Chrome"),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true
        });

        sock.ev.on('creds.update', saveCreds);

        // Allow socket connection to establish before requesting code
        await delay(3000);
        
        if (!sock.authState.creds.registered) {
            const code = await sock.requestPairingCode(num);
            // Format code clearly (e.g. XXXX-XXXX) if needed by user
            res.send({ code: code?.match(/.{1,4}/g)?.join("-") || code });
        }

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;

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
        console.error(e);
        if (!res.headersSent) res.status(500).send({ error: "Failed to generate pairing code. Please try again." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pairing server active on port ${PORT}`));
