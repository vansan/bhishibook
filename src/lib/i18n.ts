import { cookies } from "next/headers";
import { en } from "@/messages/en";
import { mr } from "@/messages/mr";

export type Locale = "en" | "mr";

const messages = { en, mr };

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("bb_locale")?.value;
  return locale === "mr" ? "mr" : "en";
}

export async function getMessages() {
  const locale = await getLocale();
  return messages[locale];
}
