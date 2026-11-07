# PlasmoVoice-Bedrock-WebBridge

Sistem proximity voice chat lintas platform untuk Minecraft Java + Bedrock.

## Tujuan

Memungkinkan komunikasi suara proximity antara:
- Java ↔ Java (menggunakan Plasmo Voice asli)
- Bedrock ↔ Bedrock (melalui browser WebRTC)
- Java ↔ Bedrock (dua arah melalui bridge)

## Arsitektur

```
[ Minecraft Java Client + Plasmo Voice ]
              ↕
[ Fabric Server + Plasmo Voice + Fabric Voice Bridge ]
              ↕ (WebSocket autentikasi + posisi + audio frame Opus)
[ Node.js Voice Gateway ]
              ↕
[ LiveKit SFU ]
              ↕
[ Browser Voice Client (Bedrock players) ]
```

## Komponen

| Komponen | Teknologi | Fungsi |
|----------|-----------|--------|
| **fabric-bridge** | Fabric Mod (Java) | Sinkronisasi player, posisi, platform (Floodgate), bridge audio Plasmo Voice |
| **gateway** | Node.js + TypeScript | Auth, proximity, session, routing audio, WebSocket |
| **web** | Vanilla JS / lightweight | Client suara untuk Bedrock (browser) |
| **media** | LiveKit | SFU WebRTC untuk transport audio real-time |

## Persyaratan Server Minecraft

- Minecraft Java **26.3**
- Fabric Loader
- Fabric API
- Geyser-Fabric
- Floodgate-Modded
- Plasmo Voice (server + client)

## Domain

- Website suara: `https://voice.survivalsculk.biz.id`

## Build

### Gateway
```bash
cd apps/gateway && npm install && npm run build
```

### Fabric
```bash
cd minecraft/fabric-bridge
./gradlew build
```

GitHub Actions: `.github/workflows/build-fabric.yml` dan `build-gateway.yml`

## Lisensi

MIT
