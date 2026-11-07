package id.survivalsculk.voicebridge.command;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import id.survivalsculk.voicebridge.VoiceBridgeMod;
import id.survivalsculk.voicebridge.player.PlayerTracker;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public final class VoiceLinkCommand {
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private VoiceLinkCommand() {}

    public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(
                Commands.literal("voice")
                        .then(Commands.literal("link")
                                .executes(VoiceLinkCommand::link))
                        .then(Commands.literal("status")
                                .executes(VoiceLinkCommand::status))
        );
    }

    private static int link(CommandContext<CommandSourceStack> ctx) {
        ServerPlayer player = ctx.getSource().getPlayer();
        if (player == null) {
            ctx.getSource().sendFailure(Component.literal("Hanya pemain yang bisa memakai perintah ini."));
            return 0;
        }

        PlayerTracker.TrackedPlayer tracked = VoiceBridgeMod.getInstance()
                .getPlayerTracker()
                .get(player.getUUID());

        String platform = tracked != null ? tracked.platform : "java";
        String username = player.getName().getString();
        String uuid = player.getUUID().toString();

        ctx.getSource().sendSuccess(() -> Component.literal("§aMeminta kode linking…"), false);

        String publicUrl = deriveHttpBase(VoiceBridgeMod.getInstance().getConfig().gatewayUrl);
        String secret = VoiceBridgeMod.getInstance().getConfig().connectorSecret;

        JsonObject body = new JsonObject();
        body.addProperty("uuid", uuid);
        body.addProperty("username", username);
        body.addProperty("platform", platform);

        CompletableFuture.runAsync(() -> {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(publicUrl + "/api/internal/linking-code"))
                        .timeout(Duration.ofSeconds(10))
                        .header("Content-Type", "application/json")
                        .header("X-Connector-Secret", secret)
                        .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                        .build();

                HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    player.sendSystemMessage(Component.literal(
                            "§cGagal membuat kode (HTTP " + response.statusCode() + "). Cek Gateway."));
                    return;
                }

                JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
                String code = json.get("code").getAsString();

                player.sendSystemMessage(Component.literal("§a§lKode Voice: §e§l" + code));
                player.sendSystemMessage(Component.literal(
                        "§7Buka §bhttps://voice.survivalsculk.biz.id §7dan masukkan kode di atas (berlaku ~5 menit)."));
            } catch (Exception e) {
                VoiceBridgeMod.LOGGER.error("linking-code request failed", e);
                player.sendSystemMessage(Component.literal(
                        "§cGagal menghubungi Voice Gateway. Coba lagi nanti."));
            }
        });

        return 1;
    }

    private static int status(CommandContext<CommandSourceStack> ctx) {
        boolean ok = VoiceBridgeMod.getInstance().getConnector().isAuthenticated();
        ctx.getSource().sendSuccess(
                () -> Component.literal(ok
                        ? "§aVoice Gateway: terhubung"
                        : "§cVoice Gateway: tidak terhubung"),
                false);
        return 1;
    }

    private static String deriveHttpBase(String gatewayUrl) {
        try {
            URI uri = URI.create(gatewayUrl);
            String scheme = "wss".equalsIgnoreCase(uri.getScheme()) ? "https" : "http";
            int port = uri.getPort();
            if (port > 0 && port != 80 && port != 443) {
                return scheme + "://" + uri.getHost() + ":" + port;
            }
            return scheme + "://" + uri.getHost();
        } catch (Exception e) {
            return "https://voice.survivalsculk.biz.id";
        }
    }
}
