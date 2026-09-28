import { Share } from "@capacitor/share";

export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/**
 * Share text via the native share sheet (or browser share dialog), falling
 * back to the clipboard when no share target is available.
 */
export async function shareTextOrCopy(title: string, text: string): Promise<ShareOutcome> {
  try {
    await Share.share({ title, text, dialogTitle: "Share via" });
    return "shared";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) return "cancelled";
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
