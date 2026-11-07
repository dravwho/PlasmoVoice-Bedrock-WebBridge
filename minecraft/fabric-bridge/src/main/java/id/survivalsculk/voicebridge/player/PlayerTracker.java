package id.survivalsculk.voicebridge.player;

import id.survivalsculk.voicebridge.VoiceBridgeMod;
import id.survivalsculk.voicebridge.connector.GatewayConnector;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.phys.Vec3;
import org.geysermc.floodgate.api.FloodgateApi;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Melacak semua player di server (Mojang mappings 26.3).
 */
public class PlayerTracker {
    private final GatewayConnector connector;
    private final Map<UUID, TrackedPlayer> tracked = new ConcurrentHashMap<>();
    private int tickCounter = 0;

    public PlayerTracker(GatewayConnector connector) {
        this.connector = connector;
    }

    public void onPlayerJoin(ServerPlayer player) {
        TrackedPlayer tp = createTracked(player);
        tracked.put(player.getUUID(), tp);
        connector.sendPlayerJoin(tp);
        VoiceBridgeMod.LOGGER.info("Player joined: {} ({}) platform={}",
                tp.username, tp.uuid, tp.platform);
    }

    public void onPlayerLeave(ServerPlayer player) {
        TrackedPlayer removed = tracked.remove(player.getUUID());
        if (removed != null) {
            connector.sendPlayerLeave(removed.uuid);
            VoiceBridgeMod.LOGGER.info("Player left: {} ({})", removed.username, removed.uuid);
        }
    }

    public void tick(MinecraftServer server) {
        tickCounter++;
        int interval = VoiceBridgeMod.getInstance().getConfig().playerSyncIntervalTicks;
        if (tickCounter < interval) return;
        tickCounter = 0;

        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            TrackedPlayer tp = tracked.get(player.getUUID());
            if (tp == null) {
                onPlayerJoin(player);
                continue;
            }

            Vec3 pos = player.position();
            String dimension = player.level().dimension().location().toString();
            String world = dimension;

            boolean moved = Math.abs(pos.x - tp.x) > 0.05
                    || Math.abs(pos.y - tp.y) > 0.05
                    || Math.abs(pos.z - tp.z) > 0.05
                    || !dimension.equals(tp.dimension);

            if (moved) {
                tp.x = pos.x;
                tp.y = pos.y;
                tp.z = pos.z;
                tp.dimension = dimension;
                tp.world = world;
                connector.sendPlayerMove(tp);
            }
        }
    }

    public TrackedPlayer get(UUID uuid) {
        return tracked.get(uuid);
    }

    private TrackedPlayer createTracked(ServerPlayer player) {
        TrackedPlayer tp = new TrackedPlayer();
        tp.uuid = player.getUUID();
        tp.username = player.getName().getString();
        Vec3 pos = player.position();
        tp.x = pos.x;
        tp.y = pos.y;
        tp.z = pos.z;
        tp.dimension = player.level().dimension().location().toString();
        tp.world = tp.dimension;

        try {
            FloodgateApi api = FloodgateApi.getInstance();
            if (api != null && api.isFloodgatePlayer(player.getUUID())) {
                tp.platform = "bedrock";
                var fgPlayer = api.getPlayer(player.getUUID());
                if (fgPlayer != null) {
                    tp.xuid = fgPlayer.getXuid();
                }
            } else {
                tp.platform = "java";
            }
        } catch (NoClassDefFoundError | Exception e) {
            tp.platform = "java";
            VoiceBridgeMod.LOGGER.debug("Floodgate not available, treating all as Java");
        }

        return tp;
    }

    public static class TrackedPlayer {
        public UUID uuid;
        public String username;
        public String platform;
        public String xuid;
        public double x, y, z;
        public String dimension;
        public String world;
    }
}
