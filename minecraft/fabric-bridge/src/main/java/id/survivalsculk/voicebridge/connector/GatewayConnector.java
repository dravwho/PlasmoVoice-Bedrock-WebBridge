package id.survivalsculk.voicebridge.connector;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import id.survivalsculk.voicebridge.VoiceBridgeMod;
import id.survivalsculk.voicebridge.config.BridgeConfig;
import id.survivalsculk.voicebridge.player.PlayerTracker;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.nio.ByteBuffer;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * WebSocket client ke Voice Gateway.
 * Berjalan di thread terpisah agar tidak memblokir main thread Minecraft.
 */
public class GatewayConnector {
    private static final Gson GSON = new Gson();

    private final BridgeConfig config;
    private WebSocketClient client;
    private final AtomicBoolean authenticated = new AtomicBoolean(false);
    private final AtomicBoolean shouldReconnect = new AtomicBoolean(true);
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "VoiceBridge-Gateway");
        t.setDaemon(true);
        return t;
    });

    public GatewayConnector(BridgeConfig config) {
        this.config = config;
    }

    public void connect() {
        shouldReconnect.set(true);
        doConnect();
    }

    public void disconnect() {
        shouldReconnect.set(false);
        authenticated.set(false);
        if (client != null) {
            try {
                client.close();
            } catch (Exception ignored) {}
        }
        scheduler.shutdownNow();
    }

    private void doConnect() {
        try {
            URI uri = new URI(config.gatewayUrl);
            client = new WebSocketClient(uri) {
                @Override
                public void onOpen(ServerHandshake handshake) {
                    VoiceBridgeMod.LOGGER.info("Connected to Voice Gateway, authenticating...");
                    JsonObject auth = new JsonObject();
                    auth.addProperty("type", "connector_auth");
                    auth.addProperty("secret", config.connectorSecret);
                    auth.addProperty("serverName", config.serverName);
                    send(GSON.toJson(auth));
                }

                @Override
                public void onMessage(String message) {
                    handleMessage(message);
                }

                @Override
                public void onMessage(ByteBuffer bytes) {
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    authenticated.set(false);
                    VoiceBridgeMod.LOGGER.warn("Gateway disconnected: {} (code {})", reason, code);
                    if (shouldReconnect.get()) {
                        scheduler.schedule(GatewayConnector.this::doConnect, 5, TimeUnit.SECONDS);
                    }
                }

                @Override
                public void onError(Exception ex) {
                    VoiceBridgeMod.LOGGER.error("Gateway WebSocket error", ex);
                }
            };
            client.connect();
        } catch (Exception e) {
            VoiceBridgeMod.LOGGER.error("Failed to connect to Gateway", e);
            if (shouldReconnect.get()) {
                scheduler.schedule(this::doConnect, 5, TimeUnit.SECONDS);
            }
        }
    }

    private void handleMessage(String raw) {
        try {
            JsonObject msg = GSON.fromJson(raw, JsonObject.class);
            String type = msg.get("type").getAsString();

            switch (type) {
                case "connector_auth_ok" -> {
                    authenticated.set(true);
                    VoiceBridgeMod.LOGGER.info("Successfully authenticated with Voice Gateway");
                }
                case "connector_auth_fail" -> {
                    authenticated.set(false);
                    String reason = msg.has("reason") ? msg.get("reason").getAsString() : "unknown";
                    VoiceBridgeMod.LOGGER.error("Gateway auth failed: {}", reason);
                }
                case "bedrock_audio_frame" -> {
                    VoiceBridgeMod.LOGGER.debug("Received bedrock_audio_frame");
                }
                case "pong" -> {
                }
                default -> VoiceBridgeMod.LOGGER.debug("Unknown gateway message: {}", type);
            }
        } catch (Exception e) {
            VoiceBridgeMod.LOGGER.error("Failed to parse gateway message", e);
        }
    }

    public boolean isAuthenticated() {
        return authenticated.get() && client != null && client.isOpen();
    }

    public void sendPlayerJoin(PlayerTracker.TrackedPlayer p) {
        if (!isAuthenticated()) return;
        JsonObject msg = new JsonObject();
        msg.addProperty("type", "player_join");
        JsonObject player = new JsonObject();
        player.addProperty("uuid", p.uuid.toString());
        player.addProperty("username", p.username);
        player.addProperty("platform", p.platform);
        if (p.xuid != null) player.addProperty("xuid", p.xuid);
        msg.add("player", player);
        msg.addProperty("dimension", p.dimension);
        msg.addProperty("world", p.world);
        JsonObject pos = new JsonObject();
        pos.addProperty("x", p.x);
        pos.addProperty("y", p.y);
        pos.addProperty("z", p.z);
        msg.add("position", pos);
        send(msg);
    }

    public void sendPlayerLeave(UUID uuid) {
        if (!isAuthenticated()) return;
        JsonObject msg = new JsonObject();
        msg.addProperty("type", "player_leave");
        msg.addProperty("uuid", uuid.toString());
        send(msg);
    }

    public void sendPlayerMove(PlayerTracker.TrackedPlayer p) {
        if (!isAuthenticated()) return;
        JsonObject msg = new JsonObject();
        msg.addProperty("type", "player_move");
        msg.addProperty("uuid", p.uuid.toString());
        msg.addProperty("dimension", p.dimension);
        msg.addProperty("world", p.world);
        JsonObject pos = new JsonObject();
        pos.addProperty("x", p.x);
        pos.addProperty("y", p.y);
        pos.addProperty("z", p.z);
        msg.add("position", pos);
        send(msg);
    }

    public void sendJavaAudioFrame(UUID uuid, long sequence, String base64Data, int distance) {
        if (!isAuthenticated()) return;
        JsonObject msg = new JsonObject();
        msg.addProperty("type", "java_audio_frame");
        msg.addProperty("uuid", uuid.toString());
        msg.addProperty("sequence", sequence);
        msg.addProperty("data", base64Data);
        msg.addProperty("distance", distance);
        send(msg);
    }

    private void send(JsonObject msg) {
        send(GSON.toJson(msg));
    }

    private void send(String json) {
        if (client != null && client.isOpen()) {
            client.send(json);
        }
    }
}
