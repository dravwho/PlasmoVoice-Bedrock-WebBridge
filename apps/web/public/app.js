/**
 * Browser Voice Client — SurvivalSculk
 * Lightweight, no heavy framework.
 */

const WS_PATH = "/ws?role=browser";
const PUBLIC_URL = window.location.origin;

let ws = null;
let sessionToken = localStorage.getItem("voice_session") || null;
let myIdentity = null;
let isMuted = false;
let localStream = null;
let room = null;

const authPanel = document.getElementById("auth-panel");
const voicePanel = document.getElementById("voice-panel");
const nearbyPanel = document.getElementById("nearby-panel");
const codeInput = document.getElementById("code-input");
const btnConnect = document.getElementById("btn-connect");
const authError = document.getElementById("auth-error");
const playerName = document.getElementById("player-name");
const connStatus = document.getElementById("conn-status");
const btnMute = document.getElementById("btn-mute");
const btnJoin = document.getElementById("btn-join");
const btnLeave = document.getElementById("btn-leave");
const nearbyList = document.getElementById("nearby-list");
const nearbyEmpty = document.getElementById("nearby-empty");
const micSelect = document.getElementById("mic-select");

function setStatus(text, cls) {
  connStatus.textContent = text;
  connStatus.className = "status " + cls;
}

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

function hideError() {
  authError.classList.add("hidden");
}

function connectWebSocket() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}${WS_PATH}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("[WS] connected");
    if (sessionToken) {
      ws.send(JSON.stringify({ type: "auth_token", token: sessionToken }));
    }
  };

  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    handleMessage(msg);
  };

  ws.onclose = () => {
    setStatus("Terputus — mencoba ulang…", "error");
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => {
    setStatus("Error koneksi", "error");
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case "auth_ok":
      myIdentity = msg.player;
      sessionToken = msg.sessionToken;
      localStorage.setItem("voice_session", sessionToken);
      authPanel.classList.add("hidden");
      voicePanel.classList.remove("hidden");
      nearbyPanel.classList.remove("hidden");
      playerName.textContent = myIdentity.username;
      setStatus("Terautentikasi", "connected");
      hideError();
      window.__livekit = {
        token: msg.livekitToken,
        url: msg.livekitUrl,
      };
      break;

    case "auth_fail":
      showError(msg.reason || "Autentikasi gagal");
      localStorage.removeItem("voice_session");
      sessionToken = null;
      break;

    case "nearby_players":
      renderNearby(msg.players || []);
      break;

    case "player_joined_nearby":
    case "player_left_nearby":
      break;

    case "voice_status":
      setStatus(
        msg.status === "connected" ? "Voice aktif" : msg.message || msg.status,
        msg.status === "connected" ? "connected" : "disconnected"
      );
      break;

    case "error":
      showError(msg.message || msg.code);
      break;
  }
}

function renderNearby(players) {
  nearbyList.innerHTML = "";
  if (!players.length) {
    nearbyEmpty.classList.remove("hidden");
    return;
  }
  nearbyEmpty.classList.add("hidden");
  for (const p of players) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${escapeHtml(p.username)} <small class="muted">(${p.platform})</small></span>
      <span class="muted">${p.distance.toFixed(1)}m</span>
    `;
    nearbyList.appendChild(li);
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

btnConnect.addEventListener("click", () => {
  const code = codeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    showError("Masukkan 6 digit angka");
    return;
  }
  hideError();
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showError("Belum terhubung ke server, tunggu sebentar…");
    connectWebSocket();
    return;
  }
  ws.send(JSON.stringify({ type: "auth_request", code }));
});

btnJoin.addEventListener("click", async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    await populateMics();
    ws?.send(JSON.stringify({ type: "join_voice" }));
    btnJoin.classList.add("hidden");
    btnLeave.classList.remove("hidden");
    setStatus("Voice aktif", "connected");
  } catch (err) {
    console.error(err);
    setStatus("Mikrofon ditolak / tidak tersedia", "error");
  }
});

btnLeave.addEventListener("click", () => {
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  ws?.send(JSON.stringify({ type: "leave_voice" }));
  btnJoin.classList.remove("hidden");
  btnLeave.classList.add("hidden");
  setStatus("Keluar dari voice", "disconnected");
});

btnMute.addEventListener("click", () => {
  isMuted = !isMuted;
  if (localStream) {
    localStream.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
  }
  btnMute.textContent = isMuted ? "🔇" : "🎤";
  ws?.send(JSON.stringify({ type: "mute", muted: isMuted }));
});

async function populateMics() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter((d) => d.kind === "audioinput");
  micSelect.innerHTML = "";
  mics.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = d.deviceId;
    opt.textContent = d.label || `Mikrofon ${i + 1}`;
    micSelect.appendChild(opt);
  });
}

connectWebSocket();
codeInput.focus();
