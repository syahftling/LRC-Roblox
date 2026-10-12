import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

function usernameOption(command) {
  return command.addStringOption((option) =>
    option.setName('username').setDescription('Username Roblox').setRequired(true).setMaxLength(20),
  );
}

function groupOption(command) {
  return command.addStringOption((option) =>
    option.setName('group').setDescription('Group ID atau tautan').setRequired(true).setMaxLength(200),
  );
}

export const commandBuilders = [
  new SlashCommandBuilder().setName('help').setDescription('Daftar command'),
  new SlashCommandBuilder().setName('ping').setDescription('Latensi bot'),
  new SlashCommandBuilder()
    .setName('eggnotify')
    .setDescription('Pengaturan notifikasi Steal An Egg')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Siapkan channel dan panel pilihan role notifikasi')
        .addChannelOption((option) =>
          option
            .setName('notification_channel')
            .setDescription('Channel untuk notifikasi egg dan event')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName('panel_channel')
            .setDescription('Channel untuk tombol pemilihan role')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName('source_channel')
            .setDescription('Channel privat untuk menerima alert dari webhook sumber egg')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Lihat status konfigurasi notifikasi'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('test').setDescription('Tampilkan contoh embed notifikasi tanpa melakukan ping'),
    ),
  usernameOption(new SlashCommandBuilder().setName('profile').setDescription('Profil Roblox')),
  usernameOption(new SlashCommandBuilder().setName('presence').setDescription('Status Roblox')),
  groupOption(new SlashCommandBuilder().setName('group').setDescription('Grup Roblox')),
  groupOption(new SlashCommandBuilder().setName('grouproles').setDescription('Rank grup Roblox')),
  new SlashCommandBuilder()
    .setName('item')
    .setDescription('Item Roblox')
    .addStringOption((option) =>
      option.setName('asset').setDescription('Asset ID atau tautan').setRequired(true).setMaxLength(200),
    ),
  usernameOption(new SlashCommandBuilder().setName('checkavatarid').setDescription('Avatar dan Asset ID')),
  usernameOption(new SlashCommandBuilder().setName('checkavatarlink').setDescription('Avatar dan tautan item')),
];

export const commandJson = commandBuilders.map((command) => command.toJSON());
export const commandNames = new Set(commandJson.map((command) => command.name));
