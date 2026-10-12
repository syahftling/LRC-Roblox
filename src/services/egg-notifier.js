import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

const GAME_URL = 'https://www.roblox.com/games/107778070777162/Steal-An-Egg';
const ROBLOX_EVENTS_URL = 'https://apis.roblox.com/virtual-events/v1/universes/10563114921/virtual-events';
const FOOTER = 'LRC Roblox • Steal An Egg Notifier';
const MAX_BODY_LENGTH = 32_768;

export const notificationTypes = {
  common: { label: 'Common Egg', color: 0x95a5a6, emoji: '🥚' },
  uncommon: { label: 'Uncommon Egg', color: 0x2ecc71, emoji: '🥚' },
  rare: { label: 'Rare Egg', color: 0x3498db, emoji: '🥚' },
  epic: { label: 'Epic Egg', color: 0x1abc9c, emoji: '🥚' },
  legendary: { label: 'Legendary Egg', color: 0x3b82f6, emoji: '🥚' },
  mythic: { label: 'Mythic Egg', color: 0xf97316, emoji: '🥚' },
  cosmic: { label: 'Cosmic Egg', color: 0xef4444, emoji: '🥚' },
  divine: { label: 'Divine Egg', color: 0xfacc15, emoji: '🥚' },
  eternal: { label: 'Eternal Egg', color: 0xa855f7, emoji: '🥚' },
  secret: { label: 'Secret Egg', color: 0x858585, emoji: '🥚' },
  events: { label: 'Game Events', color: 0x5865f2, emoji: '🎉' },
  admin_abuse: { label: 'Admin Abuse', color: 0xef4444, emoji: '⚡' },
  butterfly: { label: 'Butterfly Bloom', color: 0xec4899, emoji: '🦋' },
  other: { label: 'Other Egg Alerts', color: 0x7289da, emoji: '🥚' },
};

function emptyState() {
  return {
    guilds: {},
    processedEvents: {},
    officialEvents: {},
    officialEventsInitialized: false,
  };
}

function plainText(value, maxLength = 300) {
  return String(value ?? '')
    .replace(/@everyone|@here/gi, (match) => match.replace('@', '@\u200b'))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, maxLength) || 'Not available';
}

function safeHttpsUrl(value, fallback = null) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function discordTime(value, style = 'R') {
  const date = parseDate(value);
  return date ? `<t:${Math.floor(date.getTime() / 1000)}:${style}>` : 'Not available';
}

function clockTime(value, timeZone = 'Asia/Jakarta') {
  const date = parseDate(value);
  if (!date) return 'Now';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16) + ' UTC';
  }
}

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function tierKey(value) {
  const normalized = normalizeKey(value).replace(/_egg$/, '');
  return Object.hasOwn(notificationTypes, normalized) && !['events', 'admin_abuse', 'butterfly', 'other'].includes(normalized)
    ? normalized
    : 'other';
}

function eventKey(value) {
  const normalized = normalizeKey(value);
  if (normalized.includes('admin_abuse') || normalized.includes('adminabuse')) return 'admin_abuse';
  if (normalized.includes('butterfly')) return 'butterfly';
  return 'events';
}

function notifyRoleId(guildConfig, key) {
  return guildConfig?.roles?.[key] || null;
}

function rolePing(roleId) {
  return roleId ? `<@&${roleId}>` : '';
}

function buttonRows() {
  const entries = Object.entries(notificationTypes);
  const rows = [];
  for (let index = 0; index < entries.length; index += 5) {
    const row = new ActionRowBuilder().addComponents(
      entries.slice(index, index + 5).map(([key, item]) =>
        new ButtonBuilder()
          .setCustomId(`eggnotify:role:${key}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel(item.label)
          .setEmoji(item.emoji),
      ),
    );
    rows.push(row);
  }
  return rows;
}

function rolePanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🥚 Pengaturan Notifikasi Steal An Egg')
    .setDescription([
      'Pilih jenis notifikasi yang ingin kamu terima dengan menekan tombol di bawah.',
      '',
      '• Tombol menambahkan role jika kamu belum memilikinya.',
      '• Tekan tombol yang sama lagi untuk melepas role.',
      '• Notifikasi hanya akan menandai role yang sesuai.',
      '',
      'Data spawn telur akan ditampilkan jika sumber data spawn tersedia. Event publik resmi Roblox dipantau terpisah.',
    ].join('\n'))
    .setFooter({ text: FOOTER });
}

function buildEggEmbed(payload, timeZone) {
  const key = tierKey(payload.tier);
  const tier = notificationTypes[key];
  const egg = plainText(payload.egg || payload.name, 256);
  const location = plainText(payload.location || payload.biome, 200);
  const spawnedAt = parseDate(payload.spawnedAt) || new Date();
  const joinUrl = safeHttpsUrl(payload.joinUrl, GAME_URL);
  const imageUrl = safeHttpsUrl(payload.imageUrl);
  const embed = new EmbedBuilder()
    .setColor(tier.color)
    .setTitle(`${tier.label} Spawned!! - ${clockTime(spawnedAt, timeZone)}`)
    .setURL(joinUrl)
    .addFields(
      { name: '🥚 Egg', value: egg, inline: true },
      { name: '📍 Location', value: location, inline: true },
      { name: '⏫ Spawned', value: discordTime(spawnedAt, 'R'), inline: false },
      { name: '💵 Money', value: plainText(payload.money || payload.cashPerSecond, 80), inline: true },
      { name: '👟 Recommended Speed', value: plainText(payload.recommendedSpeed || payload.speed, 80), inline: true },
      { name: '🎮 Join Game', value: `[Click Here](${joinUrl})`, inline: false },
    )
    .setFooter({ text: FOOTER })
    .setTimestamp(spawnedAt);
  if (imageUrl) embed.setThumbnail(imageUrl);
  return { embed, key, egg, location };
}

function buildEventEmbed(payload, category = 'events', timeZone = 'Asia/Jakarta') {
  const key = Object.hasOwn(notificationTypes, category) ? category : eventKey(category);
  const kind = notificationTypes[key];
  const start = parseDate(payload.startAt || payload.changedAt);
  const end = parseDate(payload.endAt || payload.nextChangeAt);
  const title = plainText(payload.title || (key === 'butterfly' ? 'Butterfly Bloom' : kind.label), 250);
  const status = normalizeKey(payload.status || 'active');
  const active = ['active', 'started', 'live'].includes(status);
  const description = plainText(payload.description || (active ? `${title} sedang berlangsung!` : `Ada informasi baru: ${title}`), 3_500);
  const joinUrl = safeHttpsUrl(payload.joinUrl, GAME_URL);
  const imageUrl = safeHttpsUrl(payload.imageUrl);
  const embed = new EmbedBuilder()
    .setColor(kind.color)
    .setTitle(plainText(payload.displayTitle || (active ? `${title} is Active!` : title), 256))
    .setURL(joinUrl)
    .setDescription(description)
    .addFields(
      { name: '⏫ Start / Changed', value: start ? `${discordTime(start, 't')} (${discordTime(start, 'R')})` : 'Not available', inline: false },
      { name: '🔄 Next Change / Ends', value: end ? `${discordTime(end, 't')} (${discordTime(end, 'R')})` : 'Not available', inline: false },
      { name: '🎮 Join Game', value: `[Click Here](${joinUrl})`, inline: false },
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();
  if (imageUrl) embed.setThumbnail(imageUrl);
  return { embed, key, title };
}

function webhookField(fields, names) {
  const patterns = names.map((name) => new RegExp(name, 'i'));
  const field = fields.find((item) => patterns.some((pattern) => pattern.test(String(item?.name || ''))));
  if (!field) return '';
  return String(field.value || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1').trim();
}

function fromDiscordWebhook(input) {
  const embed = Array.isArray(input?.embeds) ? input.embeds[0] : null;
  const fields = Array.isArray(embed?.fields) ? embed.fields : [];
  const title = String(embed?.title || String(input?.content || '').split(/\r?\n/, 1)[0] || '');
  const description = String(embed?.description || input?.content || '');
  const fullText = `${title} ${description} ${fields.map((field) => `${field?.name || ''} ${field?.value || ''}`).join(' ')}`;
  const lineField = (labels) => {
    const pattern = new RegExp(`(?:^|\n)\s*(?:${labels.join('|')})\s*[:：]\s*([^\n]+)`, 'i');
    return pattern.exec(description)?.[1]?.replace(/\*+/g, '').trim() || '';
  };
  const egg = webhookField(fields, ['^egg$', '^egg name$', '^pet$', '^pet name$', '^creature$', '^animal$', '^spawn name$']) ||
    lineField(['egg', 'pet', 'creature', 'spawn name']) ||
    (/\b(?:egg|pet|spawn)(?:\s+name)?\s*[:：-]\s*([^\n|]+?)(?:\s+[|•—–-]\s*(?:secret|eternal|divine|cosmic|mythic|legendary|epic|rare))?$/i.exec(`${title}\n${description}`)?.[1] || '');
  const rarity = webhookField(fields, ['rarity', 'tier', 'rank']) || lineField(['rarity', 'tier']) ||
    (/\b(secret|eternal|divine|cosmic|mythic|legendary|epic|rare|uncommon|common)\b/i.exec(fullText)?.[1] || 'other');
  const location = webhookField(fields, ['location', 'biome', 'area', 'spawn area']) || lineField(['location', 'biome', 'area', 'spawn area']);
  const spawnedAt = webhookField(fields, ['spawned at', 'spawn time', 'detected at', 'time']) || lineField(['spawned at', 'spawn time', 'detected at', 'time']) || embed?.timestamp || input.timestamp;
  const money = webhookField(fields, ['money', 'income', 'per second', 'cash']) || lineField(['money', 'income', 'cash per second']);
  const recommendedSpeed = webhookField(fields, ['recommended speed', '^speed$', 'required speed']) || lineField(['recommended speed', 'required speed', 'speed']);
  const joinField = webhookField(fields, ['join game', 'game link', 'roblox link']) || lineField(['join game', 'game link', 'roblox link']);
  const joinUrl = embed?.url || /https:\/\/www\.roblox\.com\/games\/\d+[^\s)]*/i.exec(joinField)?.[0];
  const imageUrl = embed?.thumbnail?.url || embed?.image?.url || '';
  if (egg) {
    return {
      id: input.id,
      type: 'egg_spawn',
      tier: rarity,
      egg,
      location,
      spawnedAt,
      money,
      recommendedSpeed,
      joinUrl,
      imageUrl,
    };
  }
  const eventText = `${title} ${description}`;
  if (/butterfly|admin abuse|rift|event|update|race/i.test(eventText)) {
    return {
      id: input.id,
      type: 'event',
      category: /butterfly/i.test(eventText) ? 'butterfly' : /admin abuse/i.test(eventText) ? 'admin_abuse' : 'events',
      title: title || webhookField(fields, ['event']),
      description,
      status: /active|started|live/i.test(eventText) ? 'active' : 'upcoming',
      changedAt: spawnedAt,
      nextChangeAt: webhookField(fields, ['next change', 'ends at', 'end time']),
      joinUrl,
      imageUrl,
    };
  }
  throw new Error('Webhook tidak memuat field egg/pet atau event yang dikenali.');
}

function normalizePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Isi webhook harus berupa objek JSON.');
  }
  const candidate = input.type ? input : fromDiscordWebhook(input);
  const type = normalizeKey(candidate.type);
  if (!['egg_spawn', 'event'].includes(type)) {
    throw new Error('type harus bernilai "egg_spawn" atau "event" atau berupa payload Discord webhook yang memuat embed spawn/event.');
  }
  if (type === 'egg_spawn' && !String(candidate.egg || candidate.name || '').trim()) {
    throw new Error('Field egg wajib diisi untuk egg_spawn.');
  }
  if (type === 'event' && !String(candidate.title || candidate.category || '').trim()) {
    throw new Error('Field title atau category wajib diisi untuk event.');
  }
  return { ...candidate, type };
}

export class EggNotifier {
  constructor({ dataDirectory = './data', webhookSecret = '', pollIntervalMs = 300_000, timeZone = 'Asia/Jakarta' } = {}) {
    this.dataDirectory = dataDirectory;
    this.filePath = join(dataDirectory, 'egg-notifier.json');
    this.webhookSecret = String(webhookSecret || '');
    this.pollIntervalMs = Math.max(60_000, Number(pollIntervalMs) || 300_000);
    this.timeZone = timeZone || 'Asia/Jakarta';
    this.state = emptyState();
    this.client = null;
    this.timer = null;
    this.pollInProgress = false;
    this.saving = Promise.resolve();
  }

  async initialize() {
    await mkdir(this.dataDirectory, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      this.state = {
        ...emptyState(),
        ...parsed,
        guilds: parsed?.guilds && typeof parsed.guilds === 'object' ? parsed.guilds : {},
        processedEvents: parsed?.processedEvents && typeof parsed.processedEvents === 'object' ? parsed.processedEvents : {},
        officialEvents: parsed?.officialEvents && typeof parsed.officialEvents === 'object' ? parsed.officialEvents : {},
      };
    } catch (error) {
      if (error?.code !== 'ENOENT') console.error('Egg notifier state could not be read:', error);
      await this.save();
    }
  }

  async save() {
    this.saving = this.saving.catch(() => {}).then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, JSON.stringify(this.state, null, 2), 'utf8');
      await rename(temporary, this.filePath);
    });
    return this.saving;
  }

  start(client) {
    this.client = client;
    if (this.timer) clearInterval(this.timer);
    this.pollOfficialEvents().catch((error) => console.error('Roblox event poll failed:', error?.message || error));
    this.timer = setInterval(() => {
      this.pollOfficialEvents().catch((error) => console.error('Roblox event poll failed:', error?.message || error));
    }, this.pollIntervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async setupGuild(guild, notificationChannel, panelChannel, sourceChannel = null) {
    if (!guild || !notificationChannel?.isTextBased?.() || !panelChannel?.isTextBased?.()) {
      throw new Error('Pilih channel teks Discord yang valid.');
    }
    if (sourceChannel && (!sourceChannel.isTextBased?.() || sourceChannel.guildId !== guild.id)) {
      throw new Error('Pilih channel sumber yang berupa channel teks di server ini.');
    }
    const botMember = guild.members.me || await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Bot membutuhkan izin Manage Roles untuk membuat role notifikasi.');
    }

    const roles = {};
    for (const [key, details] of Object.entries(notificationTypes)) {
      let role = guild.roles.cache.find((item) => item.name === details.label);
      if (!role) {
        role = await guild.roles.create({
          name: details.label,
          color: details.color,
          mentionable: true,
          hoist: false,
          reason: 'Role notifikasi egg dan event untuk LRC Roblox',
        });
      } else {
        if (!role.editable) {
          throw new Error(`Role ${details.label} sudah ada, tetapi hierarkinya di atas role bot. Pindahkan role bot ke atasnya atau ubah nama role yang bentrok.`);
        }
        if (!role.mentionable) {
          await role.edit({ mentionable: true, reason: 'Mengaktifkan ping khusus notifikasi egg/event' });
        }
      }
      roles[key] = role.id;
    }

    this.state.guilds[guild.id] = {
      notificationChannelId: notificationChannel.id,
      panelChannelId: panelChannel.id,
      sourceChannelId: sourceChannel?.id || this.state.guilds[guild.id]?.sourceChannelId || null,
      roles,
      updatedAt: new Date().toISOString(),
    };
    await this.save();

    const panelMessage = await panelChannel.send({
      embeds: [rolePanelEmbed()],
      components: buttonRows(),
      allowedMentions: { parse: [] },
    });
    return { rolesCreated: Object.keys(roles).length, panelMessage, notificationChannel, panelChannel, sourceChannel };
  }

  async handleWebhookMessage(message) {
    if (!message?.guildId || !message?.webhookId || !message?.channelId) return false;
    const guildConfig = this.state.guilds[message.guildId];
    if (!guildConfig?.sourceChannelId || guildConfig.sourceChannelId !== message.channelId) return false;
    const payload = {
      id: `source:${message.id}`,
      content: String(message.content || ''),
      embeds: Array.isArray(message.embeds) ? message.embeds.map((embed) => embed.toJSON?.() || embed.data || embed) : [],
      timestamp: message.createdAt?.toISOString?.() || new Date().toISOString(),
    };
    try {
      await this.processExternalEvent(payload);
    } catch (error) {
      console.error('Egg source message ignored:', error?.message || error);
    }
    return true;
  }

  async handleButton(interaction) {
    if (!interaction.isButton?.() || !interaction.customId?.startsWith('eggnotify:role:')) return false;
    const key = interaction.customId.slice('eggnotify:role:'.length);
    if (!Object.hasOwn(notificationTypes, key)) {
      await interaction.reply({ content: 'Pilihan role ini tidak dikenal.', ephemeral: true });
      return true;
    }
    const guildConfig = this.state.guilds[interaction.guildId];
    const roleId = notifyRoleId(guildConfig, key);
    if (!roleId) {
      await interaction.reply({ content: 'Notifikasi belum disiapkan. Minta admin menjalankan `/eggnotify setup`.', ephemeral: true });
      return true;
    }

    try {
      const guild = interaction.guild;
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
      if (!role) throw new Error('Role not ditemukan. Admin perlu menjalankan `/eggnotify setup` kembali.');
      const member = interaction.member?.roles?.add
        ? interaction.member
        : await guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(role, 'Pengguna melepas role notifikasi egg/event');
        await interaction.reply({ content: `Role **${role.name}** berhasil dilepas.`, ephemeral: true });
      } else {
        await member.roles.add(role, 'Pengguna memilih role notifikasi egg/event');
        await interaction.reply({ content: `Role **${role.name}** berhasil ditambahkan.`, ephemeral: true });
      }
    } catch (error) {
      await interaction.reply({ content: plainText(error?.message || 'Gagal mengubah role. Periksa izin dan hierarki role bot.', 1_000), ephemeral: true }).catch(() => null);
    }
    return true;
  }

  statusEmbed(guildId) {
    const guildConfig = this.state.guilds[guildId];
    if (!guildConfig) {
      return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('Egg Notifier belum disiapkan')
        .setDescription('Jalankan `/eggnotify setup` dan pilih channel notifikasi serta channel panel role.');
    }
    const roleLines = Object.entries(guildConfig.roles || {}).map(([key, roleId]) => `• ${notificationTypes[key]?.label || key}: <@&${roleId}>`);
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Status Egg Notifier')
      .addFields(
        { name: 'Channel Notifikasi', value: `<#${guildConfig.notificationChannelId}>`, inline: true },
        { name: 'Panel Role', value: `<#${guildConfig.panelChannelId}>`, inline: true },
        { name: 'Channel Sumber', value: guildConfig.sourceChannelId ? `<#${guildConfig.sourceChannelId}>` : 'Belum diatur', inline: true },
        { name: 'Role Aktif', value: roleLines.join('\n').slice(0, 1_000) || 'Tidak ada role.', inline: false },
        { name: 'Sumber Event', value: 'Egg spawn diteruskan dari pesan webhook di channel sumber. Event publik Roblox dipantau terpisah.', inline: false },
      )
      .setFooter({ text: FOOTER });
  }

  testEmbed() {
    const sample = buildEggEmbed({
      tier: 'Secret',
      egg: 'Contoh Egg (Preview)',
      location: 'Contoh Biome',
      spawnedAt: new Date().toISOString(),
      money: '~$225m/s',
      recommendedSpeed: '20B',
      joinUrl: GAME_URL,
    }, this.timeZone);
    sample.embed.setTitle('PREVIEW • ' + sample.embed.data.title);
    return sample.embed;
  }

  async processExternalEvent(input) {
    const payload = normalizePayload(input);
    const computedId = String(payload.id || createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
    const eventId = computedId.slice(0, 200);
    const previous = this.state.processedEvents[eventId];
    const deliveredGuilds = new Set(Array.isArray(previous?.guildIds) ? previous.guildIds : []);

    let delivered = 0;
    for (const [guildId, guildConfig] of Object.entries(this.state.guilds)) {
      if (deliveredGuilds.has(guildId)) continue;
      const key = payload.type === 'egg_spawn' ? tierKey(payload.tier) : eventKey(payload.category || payload.title);
      const channel = await this.fetchNotificationChannel(guildId, guildConfig);
      if (!channel) continue;
      let embed;
      let text;
      const roleId = notifyRoleId(guildConfig, key);
      if (payload.type === 'egg_spawn') {
        const built = buildEggEmbed(payload, this.timeZone);
        embed = built.embed;
        text = `${rolePing(roleId)} ${built.egg} spawned in ${built.location}!`.trim();
      } else {
        const built = buildEventEmbed(payload, key, this.timeZone);
        embed = built.embed;
        text = `${rolePing(roleId)} ${built.title}`.trim();
      }
      await channel.send({
        content: text,
        embeds: [embed],
        allowedMentions: { parse: [], roles: roleId ? [roleId] : [] },
      });
      deliveredGuilds.add(guildId);
      delivered += 1;
    }

    if (delivered > 0) {
      this.state.processedEvents[eventId] = { at: Date.now(), guildIds: [...deliveredGuilds] };
      const ids = Object.entries(this.state.processedEvents)
        .sort((a, b) => Number(b[1]?.at ?? b[1]) - Number(a[1]?.at ?? a[1]))
        .slice(0, 2_000);
      this.state.processedEvents = Object.fromEntries(ids);
      await this.save();
    }
    return { delivered, duplicate: delivered === 0 && Boolean(previous) };
  }

  async fetchNotificationChannel(guildId, guildConfig) {
    if (!this.client || !guildConfig?.notificationChannelId) return null;
    try {
      const guild = this.client.guilds.cache.get(guildId) || await this.client.guilds.fetch(guildId);
      const channel = guild.channels.cache.get(guildConfig.notificationChannelId)
        || await guild.channels.fetch(guildConfig.notificationChannelId);
      return channel?.isTextBased?.() ? channel : null;
    } catch (error) {
      console.error(`Egg notification channel unavailable in guild ${guildId}:`, error?.message || error);
      return null;
    }
  }

  async broadcastOfficialEvent(event, mode) {
    const title = plainText(event.displayTitle || event.title || 'Roblox Event', 250);
    const category = eventKey(`${title} ${event.displayDescription || event.description || ''}`);
    const start = parseDate(event?.eventTime?.startUtc);
    const end = parseDate(event?.eventTime?.endUtc);
    const payload = {
      type: 'event',
      category,
      title,
      displayTitle: mode === 'start' ? `Jadwal Dimulai: ${title}` : `Event Roblox Baru: ${title}`,
      description: plainText(
        mode === 'start'
          ? `Waktu mulai pada jadwal event publik Roblox telah tiba. Status aktif di dalam game belum diverifikasi.\n\n${event.displayDescription || event.description || ''}`
          : event.displayDescription || event.description || 'Ada pengumuman event publik baru dari Roblox.',
        3_500,
      ),
      status: 'upcoming',
      startAt: start?.toISOString(),
      endAt: end?.toISOString(),
      joinUrl: GAME_URL,
      id: `roblox-event:${event.id}:${mode}`,
    };
    return this.processExternalEvent(payload);
  }

  async pollOfficialEvents() {
    if (this.pollInProgress || !this.client?.isReady?.()) return;
    this.pollInProgress = true;
    try {
      const response = await fetch(ROBLOX_EVENTS_URL, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      const events = Array.isArray(result?.data) ? result.data : [];
      const now = Date.now();
      const firstRun = !this.state.officialEventsInitialized;
      const updated = { ...this.state.officialEvents };

      for (const event of events) {
        if (String(event?.universeId ?? '10563114921') !== '10563114921') continue;
        if (event?.eventVisibility && event.eventVisibility !== 'public') continue;
        const id = String(event?.id || '');
        const start = parseDate(event?.eventTime?.startUtc);
        const end = parseDate(event?.eventTime?.endUtc);
        if (!id || !start || (end && end.getTime() <= now)) continue;

        const wasKnown = updated[id];
        const isStarted = start.getTime() <= now;
        if (!wasKnown) {
          let announced = firstRun && isStarted;
          if (!firstRun) {
            const result = await this.broadcastOfficialEvent(event, isStarted ? 'start' : 'announced');
            announced = Number(result?.delivered || 0) > 0;
          }
          updated[id] = {
            title: plainText(event.displayTitle || event.title, 250),
            announced,
            started: isStarted,
            startAt: start.toISOString(),
            endAt: end?.toISOString() || null,
            lastSeenAt: new Date().toISOString(),
          };
          continue;
        }

        let announced = Boolean(wasKnown.announced);
        let started = Boolean(wasKnown.started);
        if (!announced && !firstRun) {
          const result = await this.broadcastOfficialEvent(event, isStarted ? 'start' : 'announced');
          announced = Number(result?.delivered || 0) > 0;
          if (isStarted && announced) started = true;
        } else if (!started && isStarted && (!end || end.getTime() > now)) {
          await this.broadcastOfficialEvent(event, 'start');
          started = true;
        }
        updated[id] = {
          ...wasKnown,
          title: plainText(event.displayTitle || event.title, 250),
          announced,
          started,
          startAt: start.toISOString(),
          endAt: end?.toISOString() || null,
          lastSeenAt: new Date().toISOString(),
        };
      }

      const latest = Object.entries(updated).sort((a, b) => String(b[1]?.lastSeenAt || '').localeCompare(String(a[1]?.lastSeenAt || ''))).slice(0, 500);
      this.state.officialEvents = Object.fromEntries(latest);
      this.state.officialEventsInitialized = true;
      await this.save();
    } catch (error) {
      console.error('Roblox public virtual-event check failed:', error?.message || error);
    } finally {
      this.pollInProgress = false;
    }
  }

  isWebhookAuthorized(authorizationHeader = '', querySecret = '') {
    if (!this.webhookSecret) return false;
    const match = /^Bearer\s+(.+)$/i.exec(String(authorizationHeader));
    const supplied = match?.[1] || String(querySecret || '');
    if (!supplied) return false;
    const expectedBuffer = Buffer.from(this.webhookSecret);
    const suppliedBuffer = Buffer.from(supplied);
    if (expectedBuffer.length !== suppliedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, suppliedBuffer);
  }
}

export async function readJsonRequest(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString('utf8');
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_LENGTH) {
      const error = new Error('Payload webhook terlalu besar.');
      error.statusCode = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Payload harus berupa JSON yang valid.');
    error.statusCode = 400;
    throw error;
  }
}
