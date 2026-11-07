import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  MINECRAFT_SERVER_NAME: z.string().default("SurvivalSculk"),
  MINECRAFT_CONNECTOR_SECRET: z.string().min(16, "MINECRAFT_CONNECTOR_SECRET terlalu pendek"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET terlalu pendek"),
  WEBSOCKET_PATH: z.string().default("/ws"),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  PROXIMITY_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  PROXIMITY_MAX_DISTANCE: z.coerce.number().default(32),
  PROXIMITY_MIN_DISTANCE: z.coerce.number().default(2),
  PROXIMITY_FALLOFF: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  PROXIMITY_SAME_DIMENSION_ONLY: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  SESSION_TTL_SECONDS: z.coerce.number().default(3600),
  TOKEN_TTL_SECONDS: z.coerce.number().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Konfigurasi environment tidak valid:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export type Config = typeof config;
