package id.survivalsculk.voicebridge;

import id.survivalsculk.voicebridge.config.BridgeConfig;
import id.survivalsculk.voicebridge.connector.GatewayConnector;
import id.survivalsculk.voicebridge.player.PlayerTracker;
import id.survivalsculk.voicebridge.plasmo.PlasmoBridgeAddon;
import id.survivalsculk.voicebridge.command.VoiceLinkCommand;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import su.plo.voice.api.server.PlasmoVoiceServer;

public class VoiceBridgeMod implements ModInitializer {
    public static final String MOD_ID = "voicebridge";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private static VoiceBridgeMod INSTANCE;

    private BridgeConfig config;
    private GatewayConnector connector;
    private PlayerTracker playerTracker;
    private PlasmoBridgeAddon plasmoAddon;

    @Override
    public void onInitialize() {
        INSTANCE = this;
        LOGGER.info("Initializing PlasmoVoice-Bedrock-WebBridge...");

        this.config = BridgeConfig.load();
        this.connector = new GatewayConnector(config);
        this.playerTracker = new PlayerTracker(connector);
        this.plasmoAddon = new PlasmoBridgeAddon(connector);

        PlasmoVoiceServer.getAddonsLoader().load(plasmoAddon);

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            LOGGER.info("Server started — connecting to Voice Gateway...");
            connector.connect();
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            LOGGER.info("Server stopping — disconnecting from Gateway...");
            connector.disconnect();
        });

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            playerTracker.onPlayerJoin(handler.getPlayer());
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            playerTracker.onPlayerLeave(handler.getPlayer());
        });

        ServerTickEvents.END_SERVER_TICK.register(server -> {
            playerTracker.tick(server);
        });

        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
            VoiceLinkCommand.register(dispatcher);
        });

        LOGGER.info("VoiceBridge initialized. Gateway: {}", config.gatewayUrl);
    }

    public static VoiceBridgeMod getInstance() {
        return INSTANCE;
    }

    public BridgeConfig getConfig() {
        return config;
    }

    public GatewayConnector getConnector() {
        return connector;
    }

    public PlayerTracker getPlayerTracker() {
        return playerTracker;
    }
}
