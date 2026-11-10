import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sha256 } from "./crypto";

/* Two-step sign-in with an authenticator app (RFC 6238: 6 digits, 30 seconds, SHA-1 — what every app supports). */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret() {
  return base32Encode(randomBytes(20));
}

function codeAt(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** Accepts the current code and the ones just before and after it (phone clocks drift a little). */
export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(now / 30_000);
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(codeAt(secret, step + d)), Buffer.from(c)));
}

/** The link authenticator apps read from the QR code. */
export function otpauthUrl(secret: string, email: string) {
  const label = encodeURIComponent(`Span Floors admin:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Span Floors admin")}&algorithm=SHA1&digits=6&period=30`;
}

/* ---------- Recovery codes (one-time, for a lost phone) ---------- */

const normalise = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Ten codes like "k7m2-9qx4"; only their hashes are stored. */
export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => {
    const raw = base32Encode(randomBytes(5)).toLowerCase().slice(0, 8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(normalise(c))) };
}

/** If `code` is one of the unused recovery codes, returns the list without it; otherwise null. */
export function consumeRecoveryCode(hashes: string[], code: string): string[] | null {
  const h = sha256(normalise(code));
  return hashes.includes(h) ? hashes.filter((x) => x !== h) : null;
}
