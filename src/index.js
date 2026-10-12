import http from 'node:http';
import process from 'node:process';
import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';
import { handleInteraction, handleMessage } from './commands.js';
import { RobloxService } from './services/roblox.js';
import { EggNotifier, readJsonRequest } from './services/egg-notifier.js';
import { commandJson } from './command-data.js';

try {
  process.loadEnvFile?.('.env');
} catch {}

if (!process.env.DISCORD_TOKEN) process.exit(1);

const port = Number(process.env.PORT || 3000);
const cacheTtl = Number(process.env.ROBLOX_CACHE_TTL || 60_000);
const roblox = new RobloxService({ cacheTtl });
const eggNotifier = new EggNotifier({
  dataDirectory: process.env.EGG_DATA_DIR || './data',
  webhookSecret: process.env.EGG_WEBHOOK_SECRET || '',
  pollIntervalMs: Number(process.env.EGG_EVENT_POLL_MS || 300_000),
  timeZone: process.env.EGG_TIMEZONE || 'Asia/Jakarta',
});
await eggNotifier.initialize();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { parse: [], repliedUser: false },
});

client.once(Events.ClientReady, (readyClient) => {
  eggNotifier.start(client);
  if (process.env.AUTO_REGISTER_COMMANDS === 'true') {
    registerCommands().catch((error) => console.error('Slash command registration failed:', error?.message || error));
  }
  readyClient.user.setPresence({
    status: 'online',
    activities: [{ name: '/help | lrc.help', type: ActivityType.Watching }],
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (await eggNotifier.handleButton(interaction)) return;
  await handleInteraction(interaction, { client, roblox, eggNotifier });
});

client.on(Events.MessageCreate, async (message) => {
  if (await eggNotifier.handleWebhookMessage(message)) return;
  await handleMessage(message, { client, roblox });
});

client.on(Events.Error, console.error);
process.on('unhandledRejection', console.error);
process.on('uncaughtException', (error) => {
  console.error(error);
  process.exit(1);
});

const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/egg-events' && request.method === 'POST') {
    void handleEggWebhook(request, response, requestUrl);
    return;
  }
  if (requestUrl.pathname === '/health') {
    response.writeHead(client.isReady() ? 200 : 503);
    response.end(JSON.stringify({ ok: client.isReady() }));
    return;
  }
  response.writeHead(200);
  response.end(JSON.stringify({ ok: true }));
});

server.listen(port, '0.0.0.0');

async function registerCommands() {
  const clientId = process.env.CLIENT_ID;
  if (!clientId || !process.env.DISCORD_TOKEN) {
    throw new Error('CLIENT_ID dan DISCORD_TOKEN wajib diisi untuk auto-register command.');
  }
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(clientId, process.env.GUILD_ID)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body: commandJson });
  console.log('Slash commands registered.');
}

async function handleEggWebhook(request, response, requestUrl) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!eggNotifier.webhookSecret) {
    response.writeHead(503);
    response.end(JSON.stringify({ ok: false, error: 'Webhook dinonaktifkan. Atur EGG_WEBHOOK_SECRET.' }));
    return;
  }
  const querySecret = requestUrl.searchParams.get('key') || requestUrl.searchParams.get('secret') || '';
  const headerSecret = request.headers['x-egg-webhook-secret'] || request.headers.authorization || '';
  if (!eggNotifier.isWebhookAuthorized(headerSecret, querySecret)) {
    response.writeHead(401);
    response.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }
  if (!String(request.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    response.writeHead(415);
    response.end(JSON.stringify({ ok: false, error: 'Content-Type harus application/json.' }));
    return;
  }
  try {
    const payload = await readJsonRequest(request);
    const result = await eggNotifier.processExternalEvent(payload);
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    response.writeHead(Number(error?.statusCode) || 400);
    response.end(JSON.stringify({ ok: false, error: String(error?.message || 'Payload ditolak.').slice(0, 500) }));
  }
}

function shutdown() {
  eggNotifier.stop();
  server.close();
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await client.login(process.env.DISCORD_TOKEN);
