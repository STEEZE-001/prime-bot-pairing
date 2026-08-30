const express = require('express');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    fetchLatestBaileysVersion, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
app.use(express.static(__dirname));

// OPTIONAL: If WhatsApp blocks Render's IP, get a free proxy at webshare.io 
// and insert your proxy URL below. Leave empty if testing without proxy.
const PROXY_URL = process.env.PROXY_URL || ""; 

app.get('/pair', async (req, res) => {
    let num = req.query.number ? req.query.number.replace(/[^0-9]/g, '') : '';
    if (!num) return res.status(400).send({ error: "Phone number is required" });

    const sessionDir = path.join(__dirname, `./temp_${Date.now()}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    try {
        const { version } = await fetchLatestBaileysVersion();
        
        // Configure Agent if Proxy URL is provided
        const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

        const sock = makeWASocket({
            auth: state,
            version,
            agent,
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true
        });

        sock.ev.on('creds.update', saveCreds);

        // Wait 3 seconds for WebSocket initialization
        await delay(3000);

        if (!sock.authState.creds.registered) {
            // Request code from WhatsApp
            const rawCode = await sock.requestPairingCode(num);
            const formattedCode = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;
            
            // Send response back to frontend
            res.send({ code: formattedCode });
        }

        // Listen for user linking the device
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                await delay(3000);
                const credsFile = path.join(sessionDir, 'creds.json');
                
                if (fs.existsSync(credsFile)) {
                    const credsData = fs.readFileSync(credsFile);
                    const sessionString = Buffer.from(credsData).toString('base64');
                    const sessionId = `PrimeBot~${sessionString}`;

                    // Send PrimeBot Session ID to user's WhatsApp PM
                    await sock.sendMessage(`${num}@s.whatsapp.net`, {
                        text: `*PRIME BOT SESSION ID*\n\nHere is your official Session ID. Copy it to deploy your bot:\n\n\`\`\`${sessionId}\`\`\`\n\n⚠️ Keep this private!`
                    });
                }

                // Wait before closing socket and clearing temp files
                await delay(3000);
                sock.ws.close();
                fs.rmSync(sessionDir, { recursive: true, force: true });
            } else if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                // Clean up session directory if connection fails or is logged out
                if (reason === DisconnectReason.loggedOut || reason === 401) {
                    if (fs.existsSync(sessionDir)) {
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                    }
                }
            }
        });

    } catch (e) {
        console.error("Pairing Error:", e);
        if (!res.headersSent) {
            res.status(500).send({ error: "Failed to generate pairing code. Please try again." });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Prime Bot Pairing Server active on port ${PORT}`));
