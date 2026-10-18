import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 64;

type Params = { N: number; r: number; p: number };

function derive(password: string, salt: Buffer, o: Params): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      KEYLEN,
      { ...o, maxmem: 256 * 1024 * 1024 }, // N=2^17,r=8 needs ~128 MB
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  let params: Params = { N: 2 ** 14, r: 8, p: 1 }; // legacy "salt:key" hashes
  let saltHex: string | undefined;
  let keyHex: string | undefined;

  if (stored.startsWith("scrypt$")) {
    const [, n, r, p, s, k] = stored.split("$");
    params = { N: Number(n), r: Number(r), p: Number(p) };
    saltHex = s;
    keyHex = k;
  } else {
    [saltHex, keyHex] = stored.split(":");
  }
  if (
    !saltHex ||
    !keyHex ||
    ![params.N, params.r, params.p].every(Number.isInteger)
  )
    return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"), params);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validatePassword(p: unknown): string | null {
  if (typeof p !== "string" || p.length < 8)
    return "Password must be at least 8 characters.";
  if (p.length > 128) return "Password is too long.";
  return null;
}

export const normalizeEmail = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";

export const isEmail = (e: string) =>
  e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
