package id.survivalsculk.voicebridge.plasmo;

import id.survivalsculk.voicebridge.VoiceBridgeMod;
import id.survivalsculk.voicebridge.connector.GatewayConnector;
import su.plo.voice.api.addon.AddonInitializer;
import su.plo.voice.api.addon.InjectPlasmoVoice;
import su.plo.voice.api.addon.annotation.Addon;
import su.plo.voice.api.server.PlasmoVoiceServer;
import su.plo.voice.api.server.audio.capture.ServerActivation;

import java.util.Base64;
import java.util.Optional;

@Addon(
        id = "pv-addon-bedrock-webbridge",
        name = "Bedrock WebBridge",
        version = "0.1.0",
        authors = {"SurvivalSculk"}
)
public class PlasmoBridgeAddon implements AddonInitializer {

    @InjectPlasmoVoice
    private PlasmoVoiceServer voiceServer;

    private final GatewayConnector connector;

    public PlasmoBridgeAddon(GatewayConnector connector) {
        this.connector = connector;
    }

    @Override
    public void onAddonInitialize() {
        VoiceBridgeMod.LOGGER.info("Plasmo Voice addon initializing...");

        Optional<ServerActivation> proximityOpt = voiceServer.getActivationManager()
                .getActivationByName("proximity");

        if (proximityOpt.isEmpty()) {
            VoiceBridgeMod.LOGGER.warn("Proximity activation not found yet — will retry later");
            return;
        }

        ServerActivation proximity = proximityOpt.get();

        proximity.onPlayerActivation((player, packet) -> {
            try {
                byte[] encrypted = packet.getData();
                byte[] opusData = voiceServer.getDefaultEncryption().decrypt(encrypted);

                String base64 = Base64.getEncoder().encodeToString(opusData);
                connector.sendJavaAudioFrame(
                        player.getInstance().getUuid(),
                        packet.getSequenceNumber(),
                        base64,
                        packet.getDistance()
                );
            } catch (Exception e) {
                VoiceBridgeMod.LOGGER.debug("Failed to forward Java audio frame", e);
            }
            return ServerActivation.Result.IGNORED;
        });

        VoiceBridgeMod.LOGGER.info("Plasmo Voice addon ready — listening to proximity activation");
    }

    @Override
    public void onAddonShutdown() {
        VoiceBridgeMod.LOGGER.info("Plasmo Voice addon shut down");
    }

    public PlasmoVoiceServer getVoiceServer() {
        return voiceServer;
    }
}
