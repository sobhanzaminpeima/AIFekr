/** What the connected-account card shows; every field the Instagram basic scope returns, nothing invented. */
export interface IgAccountProfile {
  username: string | null;
  name: string | null;
  biography: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
}

export const PROFILE_FIELDS = "username,name,biography,profile_picture_url,followers_count,follows_count,media_count";

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export function parseAccountProfile(data: Record<string, unknown>): IgAccountProfile {
  return {
    username: text(data.username),
    name: text(data.name),
    biography: text(data.biography),
    profilePictureUrl: text(data.profile_picture_url),
    followersCount: count(data.followers_count),
    followsCount: count(data.follows_count),
    mediaCount: count(data.media_count),
  };
}
