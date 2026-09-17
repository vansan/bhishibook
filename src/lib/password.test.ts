import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("accepts the correct password", async () => {
    const hash = await hashPassword("bhishi1234");
    expect(await verifyPassword("bhishi1234", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("bhishi1234");
    expect(await verifyPassword("bhishi1235", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts, so the same password never produces the same hash", async () => {
    const [first, second] = await Promise.all([
      hashPassword("bhishi1234"),
      hashPassword("bhishi1234"),
    ]);
    expect(first).not.toBe(second);
    expect(await verifyPassword("bhishi1234", second)).toBe(true);
  });

  it("stores the parameters alongside the hash", async () => {
    const hash = await hashPassword("bhishi1234");
    expect(hash.split("$")).toHaveLength(6);
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("normalises unicode, so a Marathi password works across devices", async () => {
    // The same text composed two different ways must match.
    const composed = "पासवर्डँ123";
    const decomposed = composed.normalize("NFD");
    const hash = await hashPassword(composed);
    expect(await verifyPassword(decomposed, hash)).toBe(true);
  });

  it("refuses a password below the minimum length", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("returns false rather than throwing for a user with no password set", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", undefined)).toBe(false);
  });

  it("returns false for a corrupt or foreign hash instead of crashing login", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$1$2$3")).toBe(false);
    expect(await verifyPassword("anything", "$2b$10$abcdefghijklmnopqrstuv")).toBe(false);
  });
});
