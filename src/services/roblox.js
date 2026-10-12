const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

export class RobloxApiError extends Error {
  constructor(message, status = null, details = null) {
    super(message);
    this.name = 'RobloxApiError';
    this.status = status;
    this.details = details;
  }
}

export class RobloxService {
  constructor({ cacheTtl = 60_000 } = {}) {
    this.cacheTtl = Math.max(0, Number(cacheTtl) || 60_000);
    this.cache = new Map();
  }

  async request(url, options = {}, attempt = 0) {
    const {
      useCache = true,
      cacheTtl = this.cacheTtl,
      ...fetchOptions
    } = options;
    const method = String(fetchOptions.method ?? 'GET').toUpperCase();
    const cacheKey = useCache && method === 'GET' ? url : null;

    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached?.expiresAt > Date.now()) return cached.value;
      if (cached) this.cache.delete(cacheKey);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordBot',
          ...(fetchOptions.headers ?? {}),
        },
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter)
          ? Math.max(1_000, Math.ceil(retryAfter * 1_000))
          : 1_000 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.request(url, options, attempt + 1);
      }

      const raw = await response.text();
      let body = null;

      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }

      if (!response.ok) {
        const apiMessage = body?.errors?.[0]?.message ?? body?.message ?? null;
        throw new RobloxApiError(
          apiMessage || `Roblox API merespons HTTP ${response.status}.`,
          response.status,
          body,
        );
      }

      if (cacheKey) {
        this.cache.set(cacheKey, {
          value: body,
          expiresAt: Date.now() + Math.max(0, Number(cacheTtl) || 0),
        });
      }

      return body;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new RobloxApiError('Permintaan ke Roblox habis waktu. Coba lagi.');
      }

      if (error instanceof TypeError && attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
        return this.request(url, options, attempt + 1);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  extractId(input) {
    const match = String(input ?? '').match(/\d+/);
    if (!match) throw new RobloxApiError('ID atau tautan Roblox tidak valid.');
    return match[0];
  }

  async resolveUser(username) {
    const cleanUsername = String(username ?? '').trim().replace(/^@/, '');
    if (!cleanUsername) throw new RobloxApiError('Username Roblox wajib diisi.');

    const body = await this.request('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      useCache: false,
      body: JSON.stringify({ usernames: [cleanUsername], excludeBannedUsers: false }),
    });

    const user = body?.data?.[0];
    if (!user) throw new RobloxApiError(`Akun Roblox ${cleanUsername} tidak ditemukan.`, 404);
    return user;
  }

  async getUser(userId) {
    return this.request(`https://users.roblox.com/v1/users/${userId}`);
  }

  async getAvatarThumbnail(userId, size = '420x420') {
    const body = await this.request(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=${size}&format=Png&isCircular=false`,
      { cacheTtl: 300_000 },
    );
    return body?.data?.[0] ?? null;
  }

  async getHeadshot(userId, size = '420x420') {
    const body = await this.request(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=${size}&format=Png&isCircular=false`,
      { cacheTtl: 300_000 },
    );
    return body?.data?.[0] ?? null;
  }

  async getAvatar(userId) {
    return this.request(`https://avatar.roblox.com/v1/users/${userId}/avatar`, {
      cacheTtl: 30_000,
    });
  }

  async getPresence(userId) {
    const body = await this.request('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      useCache: false,
      body: JSON.stringify({ userIds: [Number(userId)] }),
    });
    return body?.userPresences?.[0] ?? null;
  }

  async getGroup(groupInput) {
    const groupId = this.extractId(groupInput);
    return this.request(`https://groups.roblox.com/v1/groups/${groupId}`);
  }

  async getUserGroups(userId) {
    const body = await this.request(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    return body?.data ?? [];
  }

  async getGroupRoles(groupInput) {
    const groupId = this.extractId(groupInput);
    const body = await this.request(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
    return { groupId, roles: body?.roles ?? [] };
  }

  async getAsset(assetInput) {
    const assetId = this.extractId(assetInput);
    const asset = await this.request(`https://economy.roblox.com/v2/assets/${assetId}/details`);
    const creator = asset?.Creator ?? asset?.creator ?? {};

    return {
      ...asset,
      assetId,
      name: asset?.Name ?? asset?.name ?? 'Item Roblox',
      description: asset?.Description ?? asset?.description ?? '',
      price: asset?.PriceInRobux ?? asset?.price ?? null,
      assetTypeId: asset?.AssetTypeId ?? asset?.assetTypeId ?? null,
      assetTypeName: asset?.AssetType ?? asset?.assetTypeName ?? null,
      creator: {
        ...creator,
        name: creator?.Name ?? creator?.name ?? 'Tidak tersedia',
        id: creator?.Id ?? creator?.id ?? null,
        type: creator?.CreatorType ?? creator?.type ?? null,
      },
      isForSale: Boolean(asset?.IsForSale ?? asset?.isForSale),
      isLimited: Boolean(asset?.IsLimited ?? asset?.isLimited),
      isLimitedUnique: Boolean(asset?.IsLimitedUnique ?? asset?.isLimitedUnique),
      created: asset?.Created ?? asset?.created ?? null,
      updated: asset?.Updated ?? asset?.updated ?? null,
    };
  }

  async getAssetThumbnail(assetId) {
    const body = await this.request(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`,
      { cacheTtl: 300_000 },
    );
    return body?.data?.[0] ?? null;
  }
}
