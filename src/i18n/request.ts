import { getRequestConfig } from "next-intl/server";
import { en } from "@/messages/en";
import { mr } from "@/messages/mr";

export default getRequestConfig(async () => ({
  locale: "en",
  messages: { en, mr }
}));
