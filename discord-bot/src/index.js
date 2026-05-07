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
} from 'discord.js';

const cfg = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  welcomeChannelId: process.env.DISCORD_WELCOME_CHANNEL_ID,
  adminRelayToken: process.env.DISCORD_ADMIN_RELAY_TOKEN,
  botSyncToken: process.env.DISCORD_BOT_SYNC_TOKEN,
  apiBaseUrl: process.env.CTRCHK_API_BASE_URL,
  apiBotToken: process.env.CTRCHK_API_BOT_TOKEN,
  port: Number(process.env.PORT || 8787),
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
};

if (!cfg.token || !cfg.clientId || !cfg.guildId) {
  throw new Error('Missing required env: DISCORD_BOT_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID');
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

function pickManagedRoleIds() {
  const ids = [
    ...Object.values(cfg.roleIds.cyclist),
    ...Object.values(cfg.roleIds.mileage),
    ...Object.values(cfg.roleIds.membership),
  ].filter(Boolean);
  return new Set(ids);
}

function cyclistTierKey(tierLabel) {
  const map = {
    入門車手: 'beginner',
    初階車手: 'novice',
    進階車手: 'advanced',
    資深車手: 'veteran',
    精英車手: 'elite',
    頂尖車手: 'top',
  };
  return map[tierLabel] || 'beginner';
}

function pickTargetRoleIds(profile) {
  const ids = [];
  const cyclist = cfg.roleIds.cyclist[cyclistTierKey(profile.cyclist_tier)];
  if (cyclist) ids.push(cyclist);
  const mileageKey = profile.mileage_card === '金卡' ? 'gold' : profile.mileage_card === '銀卡' ? 'silver' : 'bronze';
  const mileage = cfg.roleIds.mileage[mileageKey];
  if (mileage) ids.push(mileage);
  const membership = cfg.roleIds.membership[profile.user_role];
  if (membership) ids.push(membership);
  return ids;
}

async function syncMemberRoles(member, profile) {
  const managed = pickManagedRoleIds();
  const target = new Set(pickTargetRoleIds(profile));
  const toRemove = [...member.roles.cache.keys()].filter((id) => managed.has(id) && !target.has(id));
  const toAdd = [...target].filter((id) => !member.roles.cache.has(id));
  if (toRemove.length) await member.roles.remove(toRemove, 'CTRCHK automatic role sync');
  if (toAdd.length) await member.roles.add(toAdd, 'CTRCHK automatic role sync');
}

async function syncByDiscordId({ userId, discordId }) {
  const profile = await fetchCtrchkProfile({ userId, discordId });
  if (!profile.discord_id) return { synced: false, reason: 'discord_not_linked' };
  const guild = await client.guilds.fetch(cfg.guildId);
  const member = await guild.members.fetch(profile.discord_id);
  await syncMemberRoles(member, profile);
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

client.once('ready', async () => {
  console.log(`[CTRCHK Bot] Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(cfg.token);
  await rest.put(
    Routes.applicationGuildCommands(cfg.clientId, cfg.guildId),
    { body: [statusCommand.toJSON()] }
  );
  console.log('[CTRCHK Bot] /status command registered');
});

client.on('guildMemberAdd', async (member) => {
  if (!cfg.welcomeChannelId) return;
  const channel = await member.guild.channels.fetch(cfg.welcomeChannelId);
  if (!channel || !channel.isTextBased()) return;
  await channel.send({
    content: `🎉 歡迎 <@${member.id}> 加入 CTRCHK 社群！請先在 CTRCHK 網站連結 Discord，系統會自動同步你的會員身份、車手等級與里程卡。`,
  });
});

client.on('interactionCreate', async (interaction) => {
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
  res.status(200).json({ ok: true });
});

// Admin Relay: 後台可調用此 API，讓 Bot 以官方身份發話
app.post('/api/admin-relay', limiter, async (req, res) => {
  if (!cfg.adminRelayToken || authToken(req) !== cfg.adminRelayToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const { channelId, content, embed } = req.body || {};
  if (!channelId) return res.status(400).json({ message: 'channelId is required' });
  if (!content && !embed) return res.status(400).json({ message: 'content or embed is required' });
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ message: 'Invalid text channel' });
    }
    const payload = {};
    if (content) payload.content = String(content);
    if (embed) {
      const eb = new EmbedBuilder().setColor(embed.color || 0x2ecc71);
      if (embed.title) eb.setTitle(String(embed.title));
      if (embed.description) eb.setDescription(String(embed.description));
      if (embed.footer) eb.setFooter({ text: String(embed.footer) });
      payload.embeds = [eb];
    }
    const message = await channel.send(payload);
    return res.status(200).json({ ok: true, messageId: message.id });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

await client.login(cfg.token);
