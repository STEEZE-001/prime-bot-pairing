const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
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
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        sock.ev.on('creds.update', saveCreds);
        await delay(2000);
        
        const code = await sock.requestPairingCode(num);
        res.send({ code });

        sock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                await delay(3000);
                const credsFile = path.join(sessionDir, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    const credsData = fs.readFileSync(credsFile);
                    const sessionString = Buffer.from(credsData).toString('base64');
                    const sessionId = `PrimeBot~${sessionString}`;

                    await sock.sendMessage(`${num}@s.whatsapp.net`, {
                        text: `*PRIME BOT SESSION ID*\n\nCopy this Session ID for deployment:\n\n\`\`\`${sessionId}\`\`\``
                    });
                }
                await delay(2000);
                sock.ws.close();
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        });
    } catch (e) {
        if (!res.headersSent) res.status(500).send({ error: "Error occurred" });
    }
});

app.listen(process.env.PORT || 3000);
