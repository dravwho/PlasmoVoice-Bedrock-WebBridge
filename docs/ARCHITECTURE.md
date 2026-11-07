# Arsitektur PlasmoVoice-Bedrock-WebBridge

## Ringkasan

Sistem ini menjembatani proximity voice chat antara:

1. **Java players** → Plasmo Voice (native)
2. **Bedrock players** → Browser WebRTC client
3. **Cross-platform** (Java ↔ Bedrock) melalui Fabric Bridge + Node.js Gateway + LiveKit

## Alur Data

```
┌─────────────────────┐
│  Java Client        │
│  + Plasmo Voice     │
└──────────┬──────────┘
           │ UDP Opus (native PV)
┌──────────▼──────────┐
│  Fabric Server      │
│  - Plasmo Voice     │
│  - Geyser/Floodgate │
│  - VoiceBridge Mod  │◄──── intercept & inject audio via PV API
└──────────┬──────────┘
           │ WebSocket (auth + posisi + Opus frames)
┌──────────▼──────────┐
│  Node.js Gateway    │
│  - Auth             │
│  - Player state     │
│  - Proximity engine │
│  - Session mgmt     │
└──────────┬──────────┘
           │ LiveKit token + signaling
┌──────────▼──────────┐
│  LiveKit SFU        │
└──────────┬──────────┘
           │ WebRTC
┌──────────▼──────────┐
│  Browser Client     │
│  (Bedrock player)   │
└─────────────────────┘
```

## Komponen Utama

### 1. Fabric Voice Bridge (`minecraft/fabric-bridge`)

- Mod Fabric server-side.
- Deteksi platform lewat Floodgate API.
- Sinkronisasi join/leave/move/dimension ke Gateway.
- Plasmo Voice Addon: intercept/inject audio.
- Java-to-Java tetap murni di Plasmo Voice.

### 2. Node.js Voice Gateway (`apps/gateway`)

- TypeScript + Express + ws.
- Auth: shared secret (Fabric) + one-time code (browser).
- Player state + proximity engine.
- LiveKit access token.

### 3. Browser Voice Client (`apps/web`)

- Static HTML/CSS/JS, mobile-first.
- Auth kode 6 digit + LiveKit media.

### 4. LiveKit

- SFU room `survivalsculk-voice`.
- Proximity di application layer.
