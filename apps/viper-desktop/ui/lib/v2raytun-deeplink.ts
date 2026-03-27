/**
 * v2RayTun (docs): `v2raytun://import/{subscription_link}`
 * @see https://docs.v2raytun.com/deep-link
 *
 * Android devices cannot reach `http://127.0.0.1` / `localhost` on your dev machine.
 * Set `VITE_SUBSCRIPTION_PUBLIC_ORIGIN` (e.g. `http://10.0.2.2:4000` for emulator, or `http://192.168.x.x:4000` for a phone on LAN)
 * so the subscription URL inside the deep link points at a host the phone can reach.
 */

function readPublicOriginOverride(): string | undefined {
  try {
    const env = (
      import.meta as ImportMeta & {
        env?: { VITE_SUBSCRIPTION_PUBLIC_ORIGIN?: string };
      }
    ).env;
    const v = env?.VITE_SUBSCRIPTION_PUBLIC_ORIGIN?.trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

/**
 * If the subscription URL targets loopback, rewrite host to `publicOrigin` (env or argument).
 * No-op if the URL is already non-loopback or parsing fails.
 */
export function normalizeSubscriptionUrlForRemoteFetch(
  subscriptionUrl: string,
  publicOrigin?: string,
): string {
  const override = (publicOrigin ?? readPublicOriginOverride())?.trim();
  if (!override) return subscriptionUrl.trim();

  try {
    const u = new URL(subscriptionUrl.trim());
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      return u.toString();
    }
    const o = new URL(override);
    u.protocol = o.protocol;
    u.hostname = o.hostname;
    u.port = o.port;
    return u.toString();
  } catch {
    return subscriptionUrl.trim();
  }
}

/**
 * Deep link for “Добавить подписку” in v2RayTun. The `{subscription_link}` segment must be
 * percent-encoded when it contains `?`, `&`, etc., so the outer URI parser does not truncate it.
 */
export function buildV2rayTunSubscriptionImportDeepLink(
  subscriptionUrl: string,
  publicOrigin?: string,
): string {
  const normalized = normalizeSubscriptionUrlForRemoteFetch(subscriptionUrl, publicOrigin);
  return `v2raytun://import/${encodeURIComponent(normalized)}`;
}
