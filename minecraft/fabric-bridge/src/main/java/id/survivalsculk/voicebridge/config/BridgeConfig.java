package id.survivalsculk.voicebridge.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import id.survivalsculk.voicebridge.VoiceBridgeMod;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

public class BridgeConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path CONFIG_PATH = FabricLoader.getInstance()
            .getConfigDir()
            .resolve("voicebridge.json");

    public String gatewayUrl = "wss://voice.survivalsculk.biz.id/ws?role=connector";
    public String connectorSecret = "GANTI_DENGAN_SECRET_YANG_SAMA_DI_GATEWAY";
    public String serverName = "SurvivalSculk";
    public int playerSyncIntervalTicks = 5;
    public boolean proximityEnabled = true;
    public double maxDistance = 32.0;
    public boolean sameDimensionOnly = true;

    public static BridgeConfig load() {
        if (Files.exists(CONFIG_PATH)) {
            try (Reader reader = Files.newBufferedReader(CONFIG_PATH)) {
                BridgeConfig cfg = GSON.fromJson(reader, BridgeConfig.class);
                if (cfg != null) {
                    VoiceBridgeMod.LOGGER.info("Config loaded from {}", CONFIG_PATH);
                    return cfg;
                }
            } catch (IOException e) {
                VoiceBridgeMod.LOGGER.error("Failed to read config", e);
            }
        }
        BridgeConfig defaults = new BridgeConfig();
        defaults.save();
        return defaults;
    }

    public void save() {
        try {
            Files.createDirectories(CONFIG_PATH.getParent());
            try (Writer writer = Files.newBufferedWriter(CONFIG_PATH)) {
                GSON.toJson(this, writer);
            }
            VoiceBridgeMod.LOGGER.info("Default config written to {}", CONFIG_PATH);
        } catch (IOException e) {
            VoiceBridgeMod.LOGGER.error("Failed to write config", e);
        }
    }
}
