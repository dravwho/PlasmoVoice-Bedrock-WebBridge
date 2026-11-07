# Instalasi (Draft — akan dilengkapi seiring implementasi)

## 1. Prerequisites

- Node.js ≥ 20
- Java 21+ (untuk build Fabric mod)
- Minecraft server 26.3 + Fabric Loader + Fabric API
- Geyser-Fabric + Floodgate-Modded
- Plasmo Voice (server + client)

## 2. Gateway

```bash
cd apps/gateway
cp ../../.env.example .env
# Edit .env — isi MINECRAFT_CONNECTOR_SECRET, SESSION_SECRET, LiveKit credentials
npm install
npm run build
npm start
```

## 3. Frontend

Saat ini frontend adalah static file di `apps/web/public`.
Bisa diserve oleh Gateway (nanti) atau oleh Nginx/Caddy di depan domain `voice.survivalsculk.biz.id`.

## 4. Fabric Bridge

```bash
cd minecraft/fabric-bridge
./gradlew build
# Copy jar ke mods/ server Minecraft
```

Edit `config/voicebridge.json` di server:

```json
{
  "gatewayUrl": "wss://voice.survivalsculk.biz.id/ws?role=connector",
  "connectorSecret": "SECRET_YANG_SAMA_DENGAN_GATEWAY",
  "serverName": "SurvivalSculk",
  "playerSyncIntervalTicks": 5
}
```

## 5. LiveKit

Deploy LiveKit Server (self-host atau LiveKit Cloud).
Isi `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` di `.env` Gateway.

## 6. DNS

- A/AAAA atau CNAME `voice.survivalsculk.biz.id` → host Gateway / reverse proxy.
- Pastikan HTTPS (Let's Encrypt) dan WSS.
