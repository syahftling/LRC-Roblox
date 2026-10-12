import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import {
  accountAge,
  avatarTypeLabel,
  BRAND_COLOR,
  cleanDiscordText,
  ERROR_COLOR,
  escapeMarkdown,
  formatDate,
  formatDateTime,
  formatNumber,
  presenceInfo,
  splitLines,
  truncate,
  yesNo,
} from './utils/format.js';
import { commandNames } from './command-data.js';

const PREFIX = 'lrc.';
const COOLDOWN_MS = 3_000;
const cooldowns = new Map();

function profileUrl(userId) {
  return `https://www.roblox.com/users/${userId}/profile`;
}

function gameUrl(placeId) {
  return `https://www.roblox.com/games/${placeId}`;
}

function groupUrl(groupId) {
  return `https://www.roblox.com/communities/${groupId}`;
}

function itemUrl(assetId) {
  return `https://www.roblox.com/catalog/${assetId}`;
}

function baseEmbed(title) {
  return new EmbedBuilder().setColor(BRAND_COLOR).setTitle(title).setTimestamp();
}

function linkRow(buttons) {
  return new ActionRowBuilder().addComponents(
    buttons.map(({ label, url, emoji }) => {
      const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
      if (emoji) button.setEmoji(emoji);
      return button;
    }),
  );
}

function optional(promise, fallback = null) {
  return promise.catch(() => fallback);
}

function requireValue(value, usage) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`Gunakan ${usage}`);
  return result;
}

function getCooldown(userId, commandName) {
  const key = `${userId}:${commandName}`;
  const current = Date.now();
  const expiresAt = cooldowns.get(key) ?? 0;
  if (expiresAt > current) return expiresAt - current;
  cooldowns.set(key, current + COOLDOWN_MS);
  return 0;
}

function errorPayload(error) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(ERROR_COLOR)
        .setTitle('Perintah gagal')
        .setDescription(truncate(error?.message || 'Terjadi kesalahan.', 3_800))
        .setTimestamp(),
    ],
    components: [],
    allowedMentions: { parse: [], repliedUser: false },
  };
}

function presenceText(presence) {
  const info = presenceInfo(presence);
  return `${info.emoji} ${info.label}`;
}

function avatarItemFields(assets, mode) {
  const lines = assets.map((asset, index) => {
    const name = cleanDiscordText(asset?.name || `Item ${asset?.id || index + 1}`);
    const id = String(asset?.id ?? '');
    if (mode === 'link' && id) {
      return `${index + 1}. [${escapeMarkdown(name)}](${itemUrl(id)})`;
    }
    return `${index + 1}. **${name}** — \`${id || 'Tidak tersedia'}\``;
  });

  const chunks = splitLines(lines, 1_000).slice(0, 22);
  if (!chunks.length) {
    return [{ name: 'Item Avatar', value: 'Tidak ada data item.' }];
  }

  return chunks.map((chunk, index) => ({
    name: index === 0 ? 'Item Avatar' : `Item Avatar ${index + 1}`,
    value: chunk,
  }));
}

async function buildAvatar(username, mode, roblox) {
  const resolved = await roblox.resolveUser(username);
  const [user, avatarThumb, headshot, avatar, presence] = await Promise.all([
    roblox.getUser(resolved.id),
    optional(roblox.getAvatarThumbnail(resolved.id)),
    optional(roblox.getHeadshot(resolved.id)),
    optional(roblox.getAvatar(resolved.id), {}),
    optional(roblox.getPresence(resolved.id)),
  ]);

  const assets = Array.isArray(avatar?.assets) ? avatar.assets : [];
  const embed = baseEmbed(truncate(`Avatar ${cleanDiscordText(user.displayName)}`, 256))
    .setURL(profileUrl(user.id))
    .setDescription(
      `**${cleanDiscordText(user.displayName)}** (@${cleanDiscordText(user.name)})\n${presenceText(presence)}`,
    )
    .addFields(
      { name: 'User ID', value: `\`${user.id}\``, inline: true },
      { name: 'Jenis Avatar', value: avatarTypeLabel(avatar?.playerAvatarType), inline: true },
      { name: 'Item Dipakai', value: formatNumber(assets.length), inline: true },
      ...avatarItemFields(assets, mode),
    );

  if (avatarThumb?.imageUrl) embed.setImage(avatarThumb.imageUrl);
  if (headshot?.imageUrl) embed.setThumbnail(headshot.imageUrl);

  const buttons = [{ label: 'Buka Profil', url: profileUrl(user.id), emoji: '👤' }];
  if (avatarThumb?.imageUrl) buttons.push({ label: 'Buka Avatar', url: avatarThumb.imageUrl, emoji: '🖼️' });

  return {
    embeds: [embed],
    components: [linkRow(buttons)],
  };
}

async function buildProfile(username, roblox) {
  const resolved = await roblox.resolveUser(username);
  const [user, headshot, presence, groups] = await Promise.all([
    roblox.getUser(resolved.id),
    optional(roblox.getHeadshot(resolved.id)),
    optional(roblox.getPresence(resolved.id)),
    optional(roblox.getUserGroups(resolved.id), []),
  ]);

  const groupPreview = groups
    .slice(0, 8)
    .map((entry) => `• ${cleanDiscordText(entry?.group?.name)} — **${cleanDiscordText(entry?.role?.name)}**`)
    .join('\n');

  const embed = baseEmbed(truncate(`Profil Roblox: ${cleanDiscordText(user.displayName)}`, 256))
    .setURL(profileUrl(user.id))
    .setDescription(truncate(user.description || 'Pengguna ini belum menulis deskripsi profil.', 2_000))
    .addFields(
      { name: 'Username', value: `@${cleanDiscordText(user.name)}`, inline: true },
      { name: 'Display Name', value: cleanDiscordText(user.displayName), inline: true },
      { name: 'User ID', value: `\`${user.id}\``, inline: true },
      { name: 'Status', value: presenceText(presence), inline: true },
      { name: 'Dibuat', value: formatDate(user.created), inline: true },
      { name: 'Umur Akun', value: accountAge(user.created), inline: true },
      { name: `Grup (${groups.length})`, value: groupPreview || 'Tidak ada grup publik.' },
    );

  if (headshot?.imageUrl) embed.setThumbnail(headshot.imageUrl);

  return {
    embeds: [embed],
    components: [linkRow([{ label: 'Buka Profil', url: profileUrl(user.id), emoji: '👤' }])],
  };
}

async function buildPresence(username, roblox) {
  const resolved = await roblox.resolveUser(username);
  const [user, presence, headshot] = await Promise.all([
    roblox.getUser(resolved.id),
    roblox.getPresence(resolved.id),
    optional(roblox.getHeadshot(resolved.id)),
  ]);

  const info = presenceInfo(presence);
  const fields = [
    { name: 'Username', value: `@${cleanDiscordText(user.name)}`, inline: true },
    {
      name: 'Lokasi',
      value: truncate(presence?.lastLocation || (info.label === 'Offline' ? 'Tidak tersedia' : 'Roblox'), 1_000),
      inline: true,
    },
    {
      name: 'Place ID',
      value: presence?.placeId ? `\`${presence.placeId}\`` : 'Tidak tersedia',
      inline: true,
    },
    {
      name: 'Terakhir Online',
      value: presence?.lastOnline ? formatDateTime(presence.lastOnline) : 'Tidak tersedia',
    },
  ];

  const embed = baseEmbed(truncate(`Presence ${cleanDiscordText(user.displayName)}`, 256))
    .setDescription(`## ${info.emoji} ${info.label}`)
    .addFields(fields);

  if (headshot?.imageUrl) embed.setThumbnail(headshot.imageUrl);

  const buttons = [{ label: 'Buka Profil', url: profileUrl(user.id), emoji: '👤' }];
  if (Number(presence?.userPresenceType) === 2 && presence?.placeId) {
    buttons.push({ label: 'Buka Game', url: gameUrl(presence.placeId), emoji: '🎮' });
  }

  return {
    embeds: [embed],
    components: [linkRow(buttons)],
  };
}

async function buildGroup(groupInput, roblox) {
  const group = await roblox.getGroup(groupInput);
  const ownerName = group?.owner?.username || group?.owner?.displayName || 'Tidak tersedia';
  const embed = baseEmbed(truncate(cleanDiscordText(group.name), 256))
    .setURL(groupUrl(group.id))
    .setDescription(truncate(group.description || 'Grup ini belum memiliki deskripsi.', 2_000))
    .addFields(
      { name: 'Group ID', value: `\`${group.id}\``, inline: true },
      { name: 'Jumlah Anggota', value: formatNumber(group.memberCount), inline: true },
      { name: 'Owner', value: cleanDiscordText(ownerName), inline: true },
      { name: 'Public Entry', value: yesNo(group.publicEntryAllowed), inline: true },
      { name: 'Terkunci', value: yesNo(group.isLocked), inline: true },
      { name: 'Terverifikasi', value: yesNo(group.hasVerifiedBadge), inline: true },
    );

  return {
    embeds: [embed],
    components: [linkRow([{ label: 'Buka Grup', url: groupUrl(group.id), emoji: '👥' }])],
  };
}

async function buildGroupRoles(groupInput, roblox) {
  const group = await roblox.getGroup(groupInput);
  const { roles } = await roblox.getGroupRoles(group.id);
  const sortedRoles = [...roles].sort((a, b) => Number(b?.rank ?? 0) - Number(a?.rank ?? 0));
  const lines = sortedRoles.map(
    (role) => `• **${cleanDiscordText(role.name)}** — Rank: \`${role.rank}\` — Role ID: \`${role.id}\``,
  );
  const chunks = splitLines(lines, 3_900);
  const embeds = chunks.length
    ? chunks.slice(0, 10).map((chunk, index) => {
        const title = index === 0
          ? `Daftar Rank: ${cleanDiscordText(group.name)}`
          : `Daftar Rank ${index + 1}: ${cleanDiscordText(group.name)}`;
        const embed = baseEmbed(truncate(title, 256)).setDescription(chunk);
        if (index === chunks.length - 1 || index === 9) {
          embed.addFields({ name: 'Group ID', value: `\`${group.id}\`` });
        }
        return embed;
      })
    : [baseEmbed(truncate(`Daftar Rank: ${cleanDiscordText(group.name)}`, 256)).setDescription('Tidak ada data rank.')];

  return {
    embeds,
    components: [linkRow([{ label: 'Buka Grup', url: groupUrl(group.id), emoji: '👥' }])],
  };
}

async function buildItem(assetInput, roblox) {
  const asset = await roblox.getAsset(assetInput);
  const thumbnail = await optional(roblox.getAssetThumbnail(asset.assetId));
  const price = asset.isForSale
    ? asset.price == null
      ? 'Tersedia'
      : Number(asset.price) === 0
        ? 'Gratis'
        : `${formatNumber(asset.price)} Robux`
    : 'Tidak dijual';
  const type = asset.assetTypeName || asset.assetTypeId || 'Tidak tersedia';

  const embed = baseEmbed(truncate(cleanDiscordText(asset.name), 256))
    .setURL(itemUrl(asset.assetId))
    .setDescription(truncate(asset.description || cleanDiscordText(asset.name), 2_000))
    .addFields(
      { name: 'Asset ID', value: `\`${asset.assetId}\``, inline: true },
      { name: 'Harga', value: price, inline: true },
      { name: 'Tipe Asset', value: String(type), inline: true },
      { name: 'Creator', value: cleanDiscordText(asset.creator?.name), inline: true },
      { name: 'Dijual', value: yesNo(asset.isForSale), inline: true },
      { name: 'Limited', value: yesNo(asset.isLimited || asset.isLimitedUnique), inline: true },
      { name: 'Dibuat', value: formatDate(asset.created), inline: true },
      { name: 'Diperbarui', value: formatDate(asset.updated), inline: true },
    );

  if (thumbnail?.imageUrl) embed.setThumbnail(thumbnail.imageUrl);

  return {
    embeds: [embed],
    components: [linkRow([{ label: 'Buka Item', url: itemUrl(asset.assetId), emoji: '🛍️' }])],
  };
}

function buildHelp() {
  const embed = baseEmbed('Bantuan').setDescription(
    [
      '`/help` | `lrc.help`',
      '`/ping` | `lrc.ping`',
      '`/eggnotify setup` — mengatur notifikasi Steal An Egg (admin).',
      '`/eggnotify status` — melihat konfigurasi notifikasi.',
      '`/eggnotify test` — melihat preview embed tanpa ping role.',
      '`/profile username` | `lrc.profile username`',
      '`/presence username` | `lrc.presence username`',
      '`/group group` | `lrc.group group`',
      '`/grouproles group` | `lrc.grouproles group`',
      '`/item asset` | `lrc.item asset`',
      '`/checkavatarid username` | `lrc.checkavatarid username`',
      '`/checkavatarlink username` | `lrc.checkavatarlink username`',
    ].join('\n'),
  );

  return { embeds: [embed], components: [] };
}

function buildPing(client, createdTimestamp) {
  const roundTrip = Math.max(0, Date.now() - createdTimestamp);
  return {
    embeds: [
      baseEmbed('Pong!').addFields(
        { name: 'Discord API', value: `${Math.max(0, Math.round(client.ws.ping))} ms`, inline: true },
        { name: 'Round Trip', value: `${roundTrip} ms`, inline: true },
      ),
    ],
    components: [],
  };
}

async function execute(commandName, args, meta, dependencies) {
  const { roblox, client } = dependencies;

  switch (commandName) {
    case 'help':
      return buildHelp();
    case 'ping':
      return buildPing(client, meta.createdTimestamp);
    case 'profile':
      return buildProfile(requireValue(args.username, '`/profile username` atau `lrc.profile username`'), roblox);
    case 'presence':
      return buildPresence(requireValue(args.username, '`/presence username` atau `lrc.presence username`'), roblox);
    case 'group':
      return buildGroup(requireValue(args.group, '`/group group` atau `lrc.group group`'), roblox);
    case 'grouproles':
      return buildGroupRoles(requireValue(args.group, '`/grouproles group` atau `lrc.grouproles group`'), roblox);
    case 'item':
      return buildItem(requireValue(args.asset, '`/item asset` atau `lrc.item asset`'), roblox);
    case 'checkavatarid':
      return buildAvatar(requireValue(args.username, '`/checkavatarid username` atau `lrc.checkavatarid username`'), 'id', roblox);
    case 'checkavatarlink':
      return buildAvatar(requireValue(args.username, '`/checkavatarlink username` atau `lrc.checkavatarlink username`'), 'link', roblox);
    default:
      throw new Error('Command tidak tersedia.');
  }
}

function slashArgs(interaction) {
  return {
    username: interaction.options.getString('username'),
    group: interaction.options.getString('group'),
    asset: interaction.options.getString('asset'),
  };
}

function prefixArgs(commandName, parts) {
  const value = parts.join(' ').trim();
  if (['profile', 'presence', 'checkavatarid', 'checkavatarlink'].includes(commandName)) {
    return { username: value };
  }
  if (['group', 'grouproles'].includes(commandName)) return { group: value };
  if (commandName === 'item') return { asset: value };
  return {};
}

export async function handleInteraction(interaction, dependencies) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === 'eggnotify') {
    if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'Kamu membutuhkan izin Manage Server untuk menggunakan perintah ini.', ephemeral: true });
      return;
    }
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ ephemeral: true });
      if (subcommand === 'setup') {
        const notificationChannel = interaction.options.getChannel('notification_channel', true);
        const panelChannel = interaction.options.getChannel('panel_channel', true);
        const sourceChannel = interaction.options.getChannel('source_channel');
        const result = await dependencies.eggNotifier.setupGuild(interaction.guild, notificationChannel, panelChannel, sourceChannel);
        await interaction.editReply({
          content: `Setup selesai. ${result.rolesCreated} role notifikasi sudah disiapkan.
Channel notifikasi: <#${notificationChannel.id}>
Panel role: <#${panelChannel.id}>

Pastikan role bot berada di atas semua role notifikasi.`,
          embeds: [],
          components: [],
          allowedMentions: { parse: [] },
        });
      } else if (subcommand === 'status') {
        await interaction.editReply({ embeds: [dependencies.eggNotifier.statusEmbed(interaction.guildId)], allowedMentions: { parse: [] } });
      } else if (subcommand === 'test') {
        await interaction.editReply({ content: 'Ini hanya preview. Tidak ada role yang di-ping.', embeds: [dependencies.eggNotifier.testEmbed()], allowedMentions: { parse: [] } });
      } else {
        await interaction.editReply({ content: 'Subcommand tidak dikenal.' });
      }
    } catch (error) {
      const payload = errorPayload(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => null);
      } else {
        await interaction.reply({ ...payload, ephemeral: true }).catch(() => null);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand() || !commandNames.has(interaction.commandName)) return;

  const wait = getCooldown(interaction.user.id, interaction.commandName);
  if (wait > 0) {
    await interaction.reply(errorPayload(new Error(`Tunggu ${Math.ceil(wait / 1_000)} detik.`))).catch(() => null);
    return;
  }

  try {
    await interaction.deferReply();
    const payload = await execute(
      interaction.commandName,
      slashArgs(interaction),
      { createdTimestamp: interaction.createdTimestamp },
      dependencies,
    );
    await interaction.editReply({
      ...payload,
      allowedMentions: { parse: [], repliedUser: false },
    });
  } catch (error) {
    const payload = errorPayload(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
}

export async function handleMessage(message, dependencies) {
  if (message.author.bot || !message.guild || !message.content) return;
  const content = message.content.trim();
  if (!content.toLowerCase().startsWith(PREFIX)) return;

  const input = content.slice(PREFIX.length).trim();
  const [rawName = '', ...parts] = input.split(/\s+/);
  const commandName = rawName.toLowerCase();
  if (!commandNames.has(commandName)) return;
  if (commandName === 'eggnotify') {
    await message.reply({ content: 'Gunakan slash command `/eggnotify setup`, `/eggnotify status`, atau `/eggnotify test`.', allowedMentions: { parse: [] } }).catch(() => null);
    return;
  }

  const wait = getCooldown(message.author.id, commandName);
  if (wait > 0) {
    await message.reply(errorPayload(new Error(`Tunggu ${Math.ceil(wait / 1_000)} detik.`))).catch(() => null);
    return;
  }

  try {
    await message.channel.sendTyping().catch(() => null);
    const payload = await execute(
      commandName,
      prefixArgs(commandName, parts),
      { createdTimestamp: message.createdTimestamp },
      dependencies,
    );
    await message.reply({
      ...payload,
      allowedMentions: { parse: [], repliedUser: false },
    });
  } catch (error) {
    await message.reply(errorPayload(error)).catch(() => null);
  }
}
