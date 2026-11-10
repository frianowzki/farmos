/**
 * farmOS has exactly two profiles with fully separate data. "default" is Iya's original
 * workspace (APP_PASSCODE, Google sign-in); "p2" unlocks with FARMOS_PROFILE2_PASSCODE.
 * Every user-data row carries profile_id and every query is scoped by the session's profile.
 */
export const PROFILE_IDS = ["default", "p2"] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];
/** Settings rows that are shared caches (news wire), not user data. */
export const GLOBAL_PROFILE = "_global";
export const DEFAULT_PROFILE_NAME: Record<ProfileId, string> = { default: "Iya", p2: "Nadine" };
/** Each profile's own zone sets "today", day boundaries, streaks, recaps and the clock. */
export const DEFAULT_PROFILE_TZ: Record<ProfileId, string> = { default: "Asia/Jakarta", p2: "Asia/Manila" };
export const TZ_COOKIE = "frio_tz";
export function isTimeZone(v: unknown): v is string {
  if (typeof v !== "string" || !v || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}
export const isProfileId = (v: unknown): v is ProfileId => typeof v === "string" && (PROFILE_IDS as readonly string[]).includes(v);
