import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { env } from "./config/env";
import { authModule } from "./modules/auth";
import { webauthnModule } from "./modules/webauthn";
import { competitionsModule } from "./modules/competitions";
import { indexesModule } from "./modules/indexes";
import { marketModule } from "./modules/market";
import { ordersModule } from "./modules/orders";
import { portfolioModule } from "./modules/portfolio";
import { watchlistModule } from "./modules/watchlist";
import { closeDb } from "./lib/db";
import { closeProducer } from "./lib/kafka";
import { closeRedis, connectRedis } from "./lib/redis";
import { startWorkers, stopWorkers } from "./workers/startWorkers";
import { ensureSchemaCompatibility } from "./db/bootstrapSchema";

await connectRedis();
await ensureSchemaCompatibility();
await startWorkers();

export const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  )
  .use(
    jwt({
      name: "jwt",
      secret: env.JWT_SECRET,
      exp: "7d"
    })
  )
  .get("/health", () => ({
    ok: true,
    service: "invexa-backend",
    now: new Date().toISOString()
  }))
  .use(authModule)
  .use(webauthnModule)
  .use(marketModule)
  .use(indexesModule)
  .use(portfolioModule)
  .use(watchlistModule)
  .use(ordersModule)
  .use(competitionsModule);

const server = app.listen(env.PORT);
console.log(`Invexa backend listening on http://localhost:${env.PORT}`);

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down...`);
  await stopWorkers();
  await closeProducer();
  await closeRedis();
  await closeDb();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
