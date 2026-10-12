import process from 'node:process';
import { REST, Routes } from 'discord.js';
import { commandJson } from '../src/command-data.js';

try {
  process.loadEnvFile?.('.env');
} catch {}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) process.exit(1);

const rest = new REST().setToken(token);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

await rest.put(route, { body: commandJson });
