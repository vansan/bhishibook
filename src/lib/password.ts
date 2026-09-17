import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt from the Node standard library.
 *
 * scrypt is memory-hard and built in, so BhishiBook needs no native bcrypt or
 * argon2 build step. The parameters below follow the Node defaults, which put
 * a single hash at roughly 16MB of memory and ~100ms of work.
 *
 * Deliberately free of `server-only` and path aliases so `prisma/seed.js` can
 * require this same file and there is exactly one hashing implementation.
 */

/**
 * promisify() resolves to the 3-argument scrypt overload and loses the options
 * parameter, so this wraps the callback form directly.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

const KEY_LENGTH = 64;
const COST = 16_384; // N
const BLOCK_SIZE = 8; // r
const PARALLELISATION = 1; // p
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;

function normalise(password: string): string {
  // NFKC so a password typed in Marathi or with combining marks hashes the
  // same on every device.
  return password.normalize("NFKC");
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(normalise(password), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISATION,
    maxmem: 64 * 1024 * 1024,
  }));
}

/** Returns a self-describing string: scrypt$N$r$p$salt$hash (base64 parts). */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt);
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELISATION,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Constant-time verification. Returns false rather than throwing for any
 * malformed or missing hash, so a user row with no password simply cannot log
 * in instead of crashing the login route.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, cost, blockSize, parallelisation, saltB64, keyB64] = parts;

  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(keyB64, "base64");
    const actual = (await scryptAsync(normalise(password), salt, expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelisation),
      maxmem: 64 * 1024 * 1024,
    }));

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
