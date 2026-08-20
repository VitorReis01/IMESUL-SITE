import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const createHandoffToken = () => randomBytes(32).toString("base64url");

export const hashHandoffToken = (token) =>
  createHash("sha256").update(String(token || ""), "utf8").digest("hex");

export const safeCompareTokenHash = (token, expectedHash) => {
  const actual = Buffer.from(hashHandoffToken(token), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};
