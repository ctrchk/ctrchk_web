import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

const cfg = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  welcomeChannelId: process.env.DISCORD_WELCOME_CHANNEL_ID,
  defaultMemberRoleId: process.env.DISCORD_DEFAULT_MEMBER_ROLE_ID,
  defaultMemberRoleName: process.env.DISCORD_DEFAULT_MEMBER_ROLE_NAME || '訪客',
  adminRelayToken: process.env.DISCORD_ADMIN_RELAY_TOKEN,
  botSyncToken: process.env.DISCORD_BOT_SYNC_TOKEN,
  apiBaseUrl: process.env.CTRCHK_API_BASE_URL,
  apiBotToken: process.env.CTRCHK_API_BOT_TOKEN,
  port: Number(process.env.PORT || 8787),
  ticket: {
    channelId: process.env.DISCORD_TICKET_CHANNEL_ID,
    categoryId: process.env.DISCORD_TICKET_CATEGORY_ID,
    adminRoleId: process.env.DISCORD_TICKET_ADMIN_ROLE_ID,
    adminRoleName: process.env.DISCORD_TICKET_ADMIN_ROLE_NAME || 'CTRC 會員｜高級管理員',
  },
  roleIds: {
    cyclist: {
      beginner: process.env.ROLE_CYCLIST_BEGINNER_ID,
      novice: process.env.ROLE_CYCLIST_NOVICE_ID,
      advanced: process.env.ROLE_CYCLIST_ADVANCED_ID,
      veteran: process.env.ROLE_CYCLIST_VETERAN_ID,
      elite: process.env.ROLE_CYCLIST_ELITE_ID,
      top: process.env.ROLE_CYCLIST_TOP_ID,
    },
    mileage: {
      bronze: process.env.ROLE_MILEAGE_BRONZE_ID,
      silver: process.env.ROLE_MILEAGE_SILVER_ID,
      gold: process.env.ROLE_MILEAGE_GOLD_ID,
    },
    membership: {
      junior: process.env.ROLE_MEMBERSHIP_JUNIOR_ID,
      senior: process.env.ROLE_MEMBERSHIP_SENIOR_ID,
      vip: process.env.ROLE_MEMBERSHIP_VIP_ID,
      admin: process.env.ROLE_MEMBERSHIP_ADMIN_ID,
      senior_admin: process.env.ROLE_MEMBERSHIP_SENIOR_ADMIN_ID,
    },
  },
  roleNames: {
    cyclist: {
      beginner: process.env.ROLE_CYCLIST_BEGINNER_NAME || 'CTRC 車手｜入門',
      novice: process.env.ROLE_CYCLIST_NOVICE_NAME || 'CTRC 車手｜初階',
      advanced: process.env.ROLE_CYCLIST_ADVANCED_NAME || 'CTRC 車手｜進階',
      veteran: process.env.ROLE_CYCLIST_VETERAN_NAME || 'CTRC 車手｜資深',
      elite: process.env.ROLE_CYCLIST_ELITE_NAME || 'CTRC 車手｜精英',
      top: process.env.ROLE_CYCLIST_TOP_NAME || 'CTRC 車手｜頂尖',
    },
    mileage: {
      bronze: process.env.ROLE_MILEAGE_BRONZE_NAME || 'CTRC 里程卡｜銅卡',
      silver: process.env.ROLE_MILEAGE_SILVER_NAME || 'CTRC 里程卡｜銀卡',
      gold: process.env.ROLE_MILEAGE_GOLD_NAME || 'CTRC 里程卡｜金卡',
    },
    membership: {
      junior: process.env.ROLE_MEMBERSHIP_JUNIOR_NAME || 'CTRC 會員｜普通',
      senior: process.env.ROLE_MEMBERSHIP_SENIOR_NAME || 'CTRC 會員｜高級',
      vip: process.env.ROLE_MEMBERSHIP_VIP_NAME || 'CTRC 會員｜VIP',
      admin: process.env.ROLE_MEMBERSHIP_ADMIN_NAME || 'CTRC 會員｜管理員',
      senior_admin: process.env.ROLE_MEMBERSHIP_SENIOR_ADMIN_NAME || 'CTRC 會員｜高級管理員',
    },
  },
};

if (!cfg.token || !cfg.clientId || !cfg.guildId) {
  throw new Error('Missing required env: DISCORD_BOT_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID');
}

const runtime = {
  startedAt: new Date().toISOString(),
  discordReady: false,
  readyAt: null,
  lastDiscordError: null,
};
const shardConnectivity = new Map();

function setDiscordError(error) {
  runtime.lastDiscordError = {
    at: new Date().toISOString(),
    message: error?.message || String(error),
  };
}

function setReadyState(isReady) {
  if (isReady) {
    runtime.discordReady = true;
    runtime.readyAt = new Date().toISOString();
    runtime.lastDiscordError = null;
    return;
  }
  runtime.discordReady = false;
  runtime.readyAt = null;
}

function runtimeSnapshot() {
  return {
    startedAt: runtime.startedAt,
    discordReady: runtime.discordReady,
    readyAt: runtime.readyAt,
    lastDiscordErrorAt: runtime.lastDiscordError?.at || null,
  };
}

function updateShardConnectivity(shardId, isConnected) {
  const key = Number.isInteger(shardId) ? shardId : 0;
  const wasReady = runtime.discordReady;
  shardConnectivity.set(key, isConnected);
  const nowReady = [...shardConnectivity.values()].every(Boolean);
  if (nowReady !== wasReady) {
    setReadyState(nowReady);
  }
}

function logStartupChecklist() {
  console.log('[CTRCHK Bot] Startup checklist');
  console.log(`[CTRCHK Bot] DISCORD_CLIENT_ID set: ${Boolean(cfg.clientId)}`);
  console.log(`[CTRCHK Bot] DISCORD_GUILD_ID set: ${Boolean(cfg.guildId)}`);
  console.log(`[CTRCHK Bot] DISCORD_WELCOME_CHANNEL_ID set: ${Boolean(cfg.welcomeChannelId)}`);
  console.log(`[CTRCHK Bot] DISCORD_DEFAULT_MEMBER_ROLE_ID set: ${Boolean(cfg.defaultMemberRoleId)}`);
  console.log(`[CTRCHK Bot] DISCORD_DEFAULT_MEMBER_ROLE_NAME set: ${Boolean(cfg.defaultMemberRoleName)}`);
  console.log(`[CTRCHK Bot] DISCORD_TICKET_CHANNEL_ID set: ${Boolean(cfg.ticket.channelId)}`);
  console.log(`[CTRCHK Bot] DISCORD_TICKET_CATEGORY_ID set: ${Boolean(cfg.ticket.categoryId)}`);
  console.log(`[CTRCHK Bot] DISCORD_TICKET_ADMIN_ROLE_ID set: ${Boolean(cfg.ticket.adminRoleId)}`);
  console.log(`[CTRCHK Bot] DISCORD_TICKET_ADMIN_ROLE_NAME set: ${Boolean(cfg.ticket.adminRoleName)}`);
  console.log(`[CTRCHK Bot] DISCORD_ADMIN_RELAY_TOKEN set: ${Boolean(cfg.adminRelayToken)}`);
  console.log(`[CTRCHK Bot] DISCORD_BOT_SYNC_TOKEN set: ${Boolean(cfg.botSyncToken)}`);
  console.log(`[CTRCHK Bot] CTRCHK_API_BASE_URL (cfg.apiBaseUrl) set: ${Boolean(cfg.apiBaseUrl)}`);
  console.log(`[CTRCHK Bot] CTRCHK_API_BOT_TOKEN (cfg.apiBotToken) set: ${Boolean(cfg.apiBotToken)}`);
  if (!cfg.botSyncToken) {
    console.warn('[CTRCHK Bot] WARNING: DISCORD_BOT_SYNC_TOKEN is empty; /api/sync-user will always reject');
  }
  if (!cfg.adminRelayToken) {
    console.warn('[CTRCHK Bot] WARNING: DISCORD_ADMIN_RELAY_TOKEN is empty; /api/admin-relay will always reject');
  }
  if (!cfg.apiBaseUrl || !cfg.apiBotToken) {
    console.warn('[CTRCHK Bot] WARNING: CTRCHK_API_BASE_URL / CTRCHK_API_BOT_TOKEN missing; /status and role sync may fail');
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

function authToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

async function fetchCtrchkProfile({ userId, discordId }) {
  const url = new URL('/api/oauth', cfg.apiBaseUrl);
  url.searchParams.set('action', 'discord-profile');
  if (userId) url.searchParams.set('user_id', String(userId));
  if (discordId) url.searchParams.set('discord_id', String(discordId));

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.apiBotToken}` },
  });
  if (!resp.ok) throw new Error(`CTRCHK profile fetch failed: ${resp.status}`);
  return resp.json();
}

async function mergeCtrchkProfileWithHigher({ userId, discordId, userRole, level, totalDistanceKm }) {
  const url = new URL('/api/oauth', cfg.apiBaseUrl);
  url.searchParams.set('action', 'discord-merge-higher');
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiBotToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      discord_id: discordId,
      user_role: userRole,
      level,
      total_distance_km: totalDistanceKm,
    }),
  });
  if (!resp.ok) throw new Error(`CTRCHK profile merge failed: ${resp.status}`);
  const data = await resp.json();
  return data.profile || null;
}

/**
 * Normalize role names for matching.
 * Removes all whitespace and lowercases all characters so role matching
 * is stable against spacing/case variations in Discord role names.
 */
function normalizeRoleName(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase();
}

/**
 * Resolve cyclist tier key from profile fields.
 * Prefer explicit tier labels from API; fallback to numeric level mapping.
 */
function cyclistTierKey(tierLabel, level) {
  const map = {
    入門車手: 'beginner',
    初階車手: 'novice',
    進階車手: 'advanced',
    資深車手: 'veteran',
    精英車手: 'elite',
    頂尖車手: 'top',
  };
  const direct = map[tierLabel];
  if (direct) return direct;
  const lv = Number(level ?? 1);
  if (Number.isFinite(lv)) {
    if (lv >= 76) return 'top';
    if (lv >= 51) return 'elite';
    if (lv >= 31) return 'veteran';
    if (lv >= 16) return 'advanced';
    if (lv >= 6) return 'novice';
  }
  return 'beginner';
}

/**
 * Resolve mileage card key from profile fields.
 * Prefer explicit card label from API; fallback to total distance thresholds.
 */
function mileageCardKey(cardLabel, totalDistanceKm) {
  const MILEAGE_GOLD = '金卡';
  const MILEAGE_SILVER = '銀卡';
  const MILEAGE_BRONZE = '銅卡';
  if (cardLabel === MILEAGE_GOLD) return 'gold';
  if (cardLabel === MILEAGE_SILVER) return 'silver';
  if (cardLabel === MILEAGE_BRONZE) return 'bronze';
  const km = Number(totalDistanceKm || 0);
  if (Number.isFinite(km)) {
    if (km >= 1000) return 'gold';
    if (km >= 300) return 'silver';
  }
  return 'bronze';
}

/**
 * Resolve target Discord role ID.
 * Priority: configured role ID -> configured role name lookup in guild cache.
 */
function buildGuildRoleNameIndex(guild) {
  const index = new Map();
  for (const role of guild.roles.cache.values()) {
    index.set(normalizeRoleName(role.name), role.id);
  }
  return index;
}

function resolveRoleId(guild, group, key, roleNameIndex) {
  const byId = cfg.roleIds[group]?.[key];
  if (byId) return byId;
  const roleName = cfg.roleNames[group]?.[key];
  if (!roleName) return null;
  const target = normalizeRoleName(roleName);
  if (roleNameIndex?.has(target)) return roleNameIndex.get(target);
  return null;
}

function resolveRoleIdByIdOrName(guild, roleId, roleName, roleNameIndex) {
  if (roleId) return roleId;
  const target = normalizeRoleName(roleName);
  if (!target) return null;
  if (roleNameIndex?.has(target)) return roleNameIndex.get(target);
  return guild.roles.cache.find((role) => normalizeRoleName(role.name) === target)?.id || null;
}

const MEMBERSHIP_RANK = { junior: 1, senior: 2, vip: 3, admin: 4, senior_admin: 5 };
const CYCLIST_RANK = { beginner: 1, novice: 2, advanced: 3, veteran: 4, elite: 5, top: 6 };
const MILEAGE_RANK = { bronze: 1, silver: 2, gold: 3 };

function rankValue(rankMap, key) {
  return rankMap[key] || 0;
}

function pickHigherKey(currentKey, incomingKey, rankMap) {
  return rankValue(rankMap, incomingKey) > rankValue(rankMap, currentKey) ? incomingKey : currentKey;
}

function cyclistMinLevel(key) {
  const map = { beginner: 1, novice: 6, advanced: 16, veteran: 31, elite: 51, top: 76 };
  return map[key] || 1;
}

function mileageMinDistance(key) {
  const map = { bronze: 0, silver: 300, gold: 1000 };
  return map[key] || 0;
}

function highestRoleKeyFromMember(member, guild, group, rankMap, roleNameIndex) {
  let highest = null;
  for (const key of Object.keys(cfg.roleNames[group])) {
    const id = resolveRoleId(guild, group, key, roleNameIndex);
    if (!id || !member.roles.cache.has(id)) continue;
    if (rankValue(rankMap, key) > rankValue(rankMap, highest)) highest = key;
  }
  return highest;
}

function pickManagedRoleIds(guild, roleNameIndex) {
  const ids = [];
  for (const group of ['cyclist', 'mileage', 'membership']) {
    for (const key of Object.keys(cfg.roleNames[group])) {
      const id = resolveRoleId(guild, group, key, roleNameIndex);
      if (id) ids.push(id);
    }
  }
  return new Set(ids);
}

function pickTargetRoleIds(profile, guild, roleNameIndex) {
  const ids = [];
  const cyclist = resolveRoleId(guild, 'cyclist', cyclistTierKey(profile.cyclist_tier, profile.level), roleNameIndex);
  if (cyclist) ids.push(cyclist);
  const mileage = resolveRoleId(guild, 'mileage', mileageCardKey(profile.mileage_card, profile.total_distance_km), roleNameIndex);
  if (mileage) ids.push(mileage);
  const membership = resolveRoleId(guild, 'membership', profile.user_role, roleNameIndex);
  if (membership) ids.push(membership);
  return ids;
}

function resolveDefaultMemberRoleId(guild, roleNameIndex) {
  return resolveRoleIdByIdOrName(guild, cfg.defaultMemberRoleId, cfg.defaultMemberRoleName, roleNameIndex);
}

function resolveTicketAdminRoleId(guild, roleNameIndex) {
  return resolveRoleIdByIdOrName(guild, cfg.ticket.adminRoleId, cfg.ticket.adminRoleName, roleNameIndex);
}

async function syncMemberRoles(member, guild, profile, roleNameIndex = null) {
  const index = roleNameIndex || buildGuildRoleNameIndex(guild);
  const managed = pickManagedRoleIds(guild, index);
  const target = new Set(pickTargetRoleIds(profile, guild, index));
  const toRemove = [...member.roles.cache.keys()].filter((id) => managed.has(id) && !target.has(id));
  const toAdd = [...target].filter((id) => !member.roles.cache.has(id));
  if (toRemove.length) await member.roles.remove(toRemove, 'CTRCHK automatic role sync');
  if (toAdd.length) await member.roles.add(toAdd, 'CTRCHK automatic role sync');
}

async function syncByDiscordId({ userId, discordId }) {
  let profile = await fetchCtrchkProfile({ userId, discordId });
  if (!profile.discord_id) return { synced: false, reason: 'discord_not_linked' };
  const guild = await client.guilds.fetch(cfg.guildId);
  const member = await guild.members.fetch(profile.discord_id);
  const roleNameIndex = buildGuildRoleNameIndex(guild);

  const ctrcMembership = profile.user_role || 'junior';
  const ctrcCyclist = cyclistTierKey(profile.cyclist_tier, profile.level);
  const ctrcMileage = mileageCardKey(profile.mileage_card, profile.total_distance_km);
  const ctrcLevel = Number(profile.level || 1);
  const ctrcDistanceKm = Number(profile.total_distance_km || 0);

  const discordMembership = highestRoleKeyFromMember(member, guild, 'membership', MEMBERSHIP_RANK, roleNameIndex);
  const discordCyclist = highestRoleKeyFromMember(member, guild, 'cyclist', CYCLIST_RANK, roleNameIndex);
  const discordMileage = highestRoleKeyFromMember(member, guild, 'mileage', MILEAGE_RANK, roleNameIndex);

  const mergedMembership = pickHigherKey(ctrcMembership, discordMembership, MEMBERSHIP_RANK);
  const mergedCyclist = pickHigherKey(ctrcCyclist, discordCyclist, CYCLIST_RANK);
  const mergedMileage = pickHigherKey(ctrcMileage, discordMileage, MILEAGE_RANK);
  const mergedLevel = Math.max(ctrcLevel, cyclistMinLevel(mergedCyclist));
  const mergedDistanceKm = Math.max(ctrcDistanceKm, mileageMinDistance(mergedMileage));

  const needsCtrcWriteBack =
    rankValue(MEMBERSHIP_RANK, mergedMembership) > rankValue(MEMBERSHIP_RANK, ctrcMembership) ||
    mergedLevel > ctrcLevel ||
    mergedDistanceKm > ctrcDistanceKm;

  if (needsCtrcWriteBack) {
    const mergedProfile = await mergeCtrchkProfileWithHigher({
      userId: profile.id,
      discordId: profile.discord_id,
      userRole: mergedMembership,
      level: mergedLevel,
      totalDistanceKm: mergedDistanceKm,
    });
    if (mergedProfile) profile = mergedProfile;
  }

  await syncMemberRoles(member, guild, profile, roleNameIndex);
  return {
    synced: true,
    profile: {
      cyclist_tier: profile.cyclist_tier,
      mileage_card: profile.mileage_card,
      membership_status: profile.membership_status,
    },
  };
}

const statusCommand = new SlashCommandBuilder()
  .setName('status')
  .setDescription('查看你的 CTRCHK 里程卡、里程幣、車手等級與會員身份');

const TICKET_OPEN_BUTTON_ID = 'ctrchk_ticket_open';
const TICKET_CLOSE_BUTTON_ID = 'ctrchk_ticket_close';
const TICKET_OWNER_TOPIC_PREFIX = 'ctrchk-ticket-owner:';

function ticketOwnerTopic(ownerId) {
  return `${TICKET_OWNER_TOPIC_PREFIX}${ownerId}`;
}

function parseTicketOwnerId(topic) {
  const text = String(topic || '');
  if (!text.startsWith(TICKET_OWNER_TOPIC_PREFIX)) return null;
  return text.slice(TICKET_OWNER_TOPIC_PREFIX.length) || null;
}

function buildTicketOpenRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_OPEN_BUTTON_ID)
      .setLabel('開啟客服單')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildTicketCloseRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_CLOSE_BUTTON_ID)
      .setLabel('關閉此客服單')
      .setStyle(ButtonStyle.Danger),
  );
}

async function findOpenTicketChannel(guild, ownerId) {
  await guild.channels.fetch();
  return guild.channels.cache.find((channel) => (
    channel.type === ChannelType.GuildText
    && parseTicketOwnerId(channel.topic) === String(ownerId)
  )) || null;
}

function ticketChannelNameForUser(user) {
  const safeName = String(user.username || 'member')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16) || 'member';
  return `ticket-${safeName}-${String(user.id).slice(-4)}`;
}

async function ensureTicketPanelMessage() {
  if (!cfg.ticket.channelId) return;
  const channel = await client.channels.fetch(cfg.ticket.channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error('DISCORD_TICKET_CHANNEL_ID is not a valid text channel');
  }
  const messages = await channel.messages.fetch({ limit: 50 });
  const panelExists = [...messages.values()].some((message) => (
    message.author.id === client.user.id
    && message.components.some((row) => row.components.some((component) => component.customId === TICKET_OPEN_BUTTON_ID))
  ));
  if (panelExists) return;

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🛟 客服中心')
    .setDescription('如你有需要協助的問題，請按下方按鈕建立客服單。每位用戶同一時間只能開啟 1 張客服單。');

  await channel.send({
    embeds: [embed],
    components: [buildTicketOpenRow()],
  });
}

async function memberHasTicketAdminPermission(guild, userId) {
  const member = await guild.members.fetch(userId);
  const roleNameIndex = buildGuildRoleNameIndex(guild);
  const adminRoleId = resolveTicketAdminRoleId(guild, roleNameIndex);
  return Boolean(adminRoleId && member.roles.cache.has(adminRoleId));
}

async function registerStatusCommands() {
  const rest = new REST({ version: '10' }).setToken(cfg.token);
  const body = [statusCommand.toJSON()];
  try {
    await rest.put(Routes.applicationGuildCommands(cfg.clientId, cfg.guildId), { body });
    console.log('[CTRCHK Bot] /status guild command registered');
  } catch (error) {
    console.error('[CTRCHK Bot] Failed to register guild /status command:', error.message);
  }
  try {
    await rest.put(Routes.applicationCommands(cfg.clientId), { body });
    console.log('[CTRCHK Bot] /status global command registered');
  } catch (error) {
    console.error('[CTRCHK Bot] Failed to register global /status command:', error.message);
  }
}

client.once('ready', async () => {
  setReadyState(true);
  console.log(`[CTRCHK Bot] Logged in as ${client.user.tag}`);
  await registerStatusCommands();
  try {
    await ensureTicketPanelMessage();
  } catch (error) {
    console.error('[CTRCHK Bot] Failed to ensure ticket panel message:', error.message);
  }
});

client.on('error', (error) => {
  setDiscordError(error);
  console.error('[CTRCHK Bot] Client error:', error.message);
});

client.on('shardError', (error) => {
  setDiscordError(error);
  console.error('[CTRCHK Bot] Shard error:', error.message);
});

client.on('shardDisconnect', (event, id) => {
  updateShardConnectivity(id, false);
  console.warn(`[CTRCHK Bot] Shard ${id} disconnected with code ${event.code}`);
});

client.on('shardResume', (id, replayedEvents) => {
  updateShardConnectivity(id, true);
  console.log(`[CTRCHK Bot] Shard ${id} resumed (${replayedEvents} replayed events)`);
});

client.on('shardReady', (id) => {
  updateShardConnectivity(id, true);
  console.log(`[CTRCHK Bot] Shard ${id} ready`);
});

client.on('guildMemberAdd', async (member) => {
  try {
    const roleNameIndex = buildGuildRoleNameIndex(member.guild);
    const visitorRoleId = resolveDefaultMemberRoleId(member.guild, roleNameIndex);
    if (visitorRoleId && !member.roles.cache.has(visitorRoleId)) {
      await member.roles.add(visitorRoleId, 'Assign default visitor role for new members');
    } else if (!visitorRoleId) {
      console.warn('[CTRCHK Bot] Default member role not found; skip assigning visitor role');
    }
  } catch (error) {
    console.error('[CTRCHK Bot] Failed to assign default member role:', error.message);
  }

  if (!cfg.welcomeChannelId) return;
  try {
    const channel = await member.guild.channels.fetch(cfg.welcomeChannelId);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({
      content: `🎉 歡迎 <@${member.id}> 加入 CTRCHK 社群！請先在 CTRCHK 網站連結 Discord，系統會自動同步你的會員身份、車手等級與里程卡。`,
    });
  } catch (error) {
    console.error('[CTRCHK Bot] Failed to send welcome message:', error.message);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === TICKET_OPEN_BUTTON_ID) {
    if (!interaction.guild) {
      await interaction.reply({ content: '此功能只能在伺服器內使用。', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const roleNameIndex = buildGuildRoleNameIndex(interaction.guild);
      const adminRoleId = resolveTicketAdminRoleId(interaction.guild, roleNameIndex);
      if (!adminRoleId) {
        await interaction.editReply('未找到「高級管理員」身份組，請先完成 Ticket 角色設定。');
        return;
      }

      const existing = await findOpenTicketChannel(interaction.guild, interaction.user.id);
      if (existing) {
        await interaction.editReply(`你已有未關閉的客服單：<#${existing.id}>`);
        return;
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: ticketChannelNameForUser(interaction.user),
        type: ChannelType.GuildText,
        topic: ticketOwnerTopic(interaction.user.id),
        parent: cfg.ticket.categoryId || undefined,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: adminRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
      });

      await ticketChannel.send({
        content: `🎫 <@${interaction.user.id}> 你好，這是你的專屬客服單頻道。請描述你的問題，高級管理員會盡快跟進。`,
        components: [buildTicketCloseRow()],
      });

      await interaction.editReply(`已為你建立客服單：<#${ticketChannel.id}>`);
    } catch (error) {
      await interaction.editReply(`建立客服單失敗：${error.message}`);
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === TICKET_CLOSE_BUTTON_ID) {
    if (!interaction.guild || interaction.channel?.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '此功能只能在 Ticket 頻道使用。', ephemeral: true });
      return;
    }
    const ownerId = parseTicketOwnerId(interaction.channel.topic);
    if (!ownerId) {
      await interaction.reply({ content: '這不是可關閉的客服單頻道。', ephemeral: true });
      return;
    }
    try {
      const isOwner = interaction.user.id === ownerId;
      const isTicketAdmin = await memberHasTicketAdminPermission(interaction.guild, interaction.user.id);
      if (!isOwner && !isTicketAdmin) {
        await interaction.reply({ content: '只有該客服單用戶或高級管理員可關閉。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: '客服單將於 3 秒後關閉。', ephemeral: true });
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket closed by owner/admin');
        } catch (error) {
          console.error('[CTRCHK Bot] Failed to delete ticket channel:', error.message);
        }
      }, 3000);
    } catch (error) {
      await interaction.reply({ content: `關閉客服單失敗：${error.message}`, ephemeral: true });
    }
    return;
  }

  if (!interaction.isChatInputCommand() || interaction.commandName !== 'status') return;
  try {
    const profile = await fetchCtrchkProfile({ discordId: interaction.user.id });
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🚴 CTRCHK 會員狀態')
      .addFields(
        { name: '里程卡類別', value: profile.mileage_card || '銅卡', inline: true },
        { name: '里程幣餘額', value: `${Number(profile.coins || 0).toLocaleString()} 里程幣`, inline: true },
        { name: '車手等級', value: `${profile.cyclist_tier || '入門車手'}（Lv.${profile.level || 1}）`, inline: false },
        { name: '會員身份', value: profile.membership_status || '普通會員', inline: true },
      )
      .setFooter({ text: 'CTRCHK 香港城市運輸單車' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    await interaction.reply({ content: '尚未連結 CTRCHK 帳戶或暫時無法讀取資料。', ephemeral: true });
  }
});

const app = express();
app.use(express.json());
const limiter = rateLimit({
  windowMs: Number(process.env.RELAY_RATE_WINDOW_MS || 60_000),
  max: Number(process.env.RELAY_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({
    ok: true,
    uptimeSec: Math.floor(process.uptime()),
    runtime: runtimeSnapshot(),
    discord: {
      loggedInUser: client.user?.tag || null,
      welcomeChannelConfigured: Boolean(cfg.welcomeChannelId),
      defaultMemberRoleConfigured: Boolean(cfg.defaultMemberRoleId || cfg.defaultMemberRoleName),
      ticketChannelConfigured: Boolean(cfg.ticket.channelId),
      ticketAdminRoleConfigured: Boolean(cfg.ticket.adminRoleId || cfg.ticket.adminRoleName),
    },
  });
});

app.get('/readyz', (_req, res) => {
  if (!runtime.discordReady) {
    return res.status(503).json({
      ok: false,
      message: 'Discord client is not ready',
      runtime: runtimeSnapshot(),
    });
  }
  return res.status(200).json({
    ok: true,
    runtime: runtimeSnapshot(),
  });
});

const FETCH_LIMIT_DEFAULT = 20;
const FETCH_LIMIT_MIN = 1;
const FETCH_LIMIT_MAX = 50;

/** Map common Discord API error codes to actionable Chinese messages. */
function discordErrorMessage(error) {
  if (error?.code === 50013) {
    return 'Bot 缺少頻道權限，請確認 Bot 角色在該頻道擁有「View Channel」及「Send Messages」權限（如為公告頻道還需「Send Messages in Threads」）';
  }
  if (error?.code === 50001) {
    return 'Bot 無法存取該頻道，請確認 Bot 已被邀請至伺服器且頻道 ID 正確';
  }
  if (error?.code === 10003) {
    return '找不到指定頻道，請確認頻道 ID 正確';
  }
  if (error?.code === 10008) {
    return '找不到指定消息，請確認消息 ID 正確';
  }
  return error?.message || String(error);
}

function buildEmbedPayload(embed) {
  const eb = new EmbedBuilder().setColor(embed.color || 0x2ecc71);
  if (embed.title) eb.setTitle(String(embed.title));
  if (embed.description) eb.setDescription(String(embed.description));
  if (embed.footer) eb.setFooter({ text: String(embed.footer) });
  return eb;
}

// Admin Relay: 後台可調用此 API，讓 Bot 以官方身份發話
app.post('/api/admin-relay', limiter, async (req, res) => {
  if (!cfg.adminRelayToken || authToken(req) !== cfg.adminRelayToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const { action = 'send', channelId, messageId, content, embed, limit } = req.body || {};

  if (!channelId) return res.status(400).json({ message: 'channelId is required' });

  try {
    // ── fetch_messages ──────────────────────────────────────────────────────
    if (action === 'fetch_messages') {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ message: 'Invalid text channel' });
      }
      const fetchLimit = Math.min(Math.max(Number(limit) || FETCH_LIMIT_DEFAULT, FETCH_LIMIT_MIN), FETCH_LIMIT_MAX);
      const fetched = await channel.messages.fetch({ limit: fetchLimit });
      const messages = [...fetched.values()].map((m) => ({
        messageId: m.id,
        content: m.content,
        authorId: m.author.id,
        authorTag: m.author.tag,
        isBot: m.author.bot,
        createdAt: m.createdAt.toISOString(),
        hasEmbeds: m.embeds.length > 0,
      }));
      return res.status(200).json({ ok: true, messages });
    }

    // ── delete ───────────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (!messageId) return res.status(400).json({ message: 'messageId is required for delete' });
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ message: 'Invalid text channel' });
      }
      const msg = await channel.messages.fetch(messageId);
      if (!msg.author.bot || msg.author.id !== client.user.id) {
        return res.status(403).json({ message: 'Bot 只能刪除自己發送的消息' });
      }
      await msg.delete();
      return res.status(200).json({ ok: true, deleted: true });
    }

    // ── edit ─────────────────────────────────────────────────────────────────
    if (action === 'edit') {
      if (!messageId) return res.status(400).json({ message: 'messageId is required for edit' });
      if (!content && !embed) return res.status(400).json({ message: 'content or embed is required' });
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ message: 'Invalid text channel' });
      }
      const msg = await channel.messages.fetch(messageId);
      if (!msg.author.bot || msg.author.id !== client.user.id) {
        return res.status(403).json({ message: 'Bot 只能編輯自己發送的消息' });
      }
      const payload = {};
      if (content !== undefined) payload.content = String(content);
      if (embed) payload.embeds = [buildEmbedPayload(embed)];
      const edited = await msg.edit(payload);
      return res.status(200).json({ ok: true, messageId: edited.id });
    }

    // ── send (default) ───────────────────────────────────────────────────────
    if (!content && !embed) return res.status(400).json({ message: 'content or embed is required' });
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ message: 'Invalid text channel' });
    }
    const payload = {};
    if (content) payload.content = String(content);
    if (embed) payload.embeds = [buildEmbedPayload(embed)];
    const message = await channel.send(payload);
    return res.status(200).json({ ok: true, messageId: message.id });
  } catch (error) {
    return res.status(500).json({ message: discordErrorMessage(error) });
  }
});

// 網站連結 Discord 後可呼叫此 API 同步角色
app.post('/api/sync-user', limiter, async (req, res) => {
  if (!cfg.botSyncToken || authToken(req) !== cfg.botSyncToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const result = await syncByDiscordId({
      userId: req.body?.userId,
      discordId: req.body?.discordId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.listen(cfg.port, () => {
  console.log(`[CTRCHK Bot API] listening on :${cfg.port}`);
});

logStartupChecklist();

try {
  await client.login(cfg.token);
} catch (error) {
  setDiscordError(error);
  console.error('[CTRCHK Bot] Login failed. Check DISCORD_BOT_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID and Discord permissions.');
  throw error;
}
