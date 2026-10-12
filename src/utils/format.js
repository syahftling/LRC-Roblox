export const BRAND_COLOR = 0x00a2ff;
export const ERROR_COLOR = 0xed4245;

export function truncate(value, max = 1_000) {
  const text = String(value ?? 'Tidak tersedia');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Tidak tersedia';
  return new Intl.NumberFormat('id-ID').format(number);
}

export function formatDate(value) {
  if (value == null || value === '') return 'Tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export function formatDateTime(value) {
  if (value == null || value === '') return 'Tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export function accountAge(value) {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return 'Tidak tersedia';
  const now = new Date();
  let years = now.getFullYear() - created.getFullYear();
  let months = now.getMonth() - created.getMonth();
  let days = now.getDate() - created.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += previousMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years > 0) return `${years} tahun ${months} bulan`;
  if (months > 0) return `${months} bulan ${days} hari`;
  return `${Math.max(0, days)} hari`;
}

export function yesNo(value) {
  return value ? 'Ya' : 'Tidak';
}

export function cleanDiscordText(value) {
  return String(value ?? '').replace(/@/g, '@\u200b');
}

export function escapeMarkdown(value) {
  return cleanDiscordText(value).replace(/([\\`*_{}\[\]()<>#+\-.!|])/g, '\\$1');
}

export function presenceInfo(presence) {
  const type = Number(presence?.userPresenceType);
  const values = {
    0: { emoji: '⚫', label: 'Offline' },
    1: { emoji: '🟢', label: 'Online' },
    2: { emoji: '🎮', label: 'Sedang bermain' },
    3: { emoji: '🛠️', label: 'Roblox Studio' },
    4: { emoji: '⚪', label: 'Tidak terlihat' },
  };
  return values[type] ?? { emoji: '❔', label: 'Tidak diketahui' };
}

export function avatarTypeLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'Tidak diketahui';
  const match = text.match(/R\d+/i);
  return match ? match[0].toUpperCase() : text;
}

export function splitLines(lines, maxLength = 1_000) {
  const chunks = [];
  let current = '';

  for (const rawLine of lines) {
    const line = truncate(rawLine, maxLength);
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = line;
  }

  if (current) chunks.push(current);
  return chunks;
}
