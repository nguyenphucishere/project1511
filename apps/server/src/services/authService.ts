import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export interface AuthSession {
  userId: string;
  username: string;
}

export const GuestLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[\w .-]+$/, "letters, digits, space, _ . - only"),
});

interface TokenPayload {
  sub: string;
  name: string;
  iat: number;
  exp: number;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const HEADER = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

/**
 * Guest identity: no passwords, just a signed token binding a random user id to a callsign.
 * Minimal HS256 JWT built on node:crypto to avoid an extra dependency.
 */
export class AuthService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  issueGuestToken(username: string): { token: string; session: AuthSession } {
    const iat = Math.floor(this.now() / 1000);
    const session: AuthSession = { userId: randomUUID(), username };
    const payload: TokenPayload = {
      sub: session.userId,
      name: session.username,
      iat,
      exp: iat + this.ttlSeconds,
    };
    const body = `${HEADER}.${b64url(JSON.stringify(payload))}`;
    return { token: `${body}.${this.sign(body)}`, session };
  }

  /** Returns the session for a valid, unexpired token, otherwise null. */
  validateToken(token: string | null | undefined): AuthSession | null {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payloadPart, signature] = parts as [string, string, string];
    if (header !== HEADER) return null;

    const expected = Buffer.from(this.sign(`${header}.${payloadPart}`));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    let payload: TokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as TokenPayload;
    } catch {
      return null;
    }
    if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= this.now()) return null;
    return { userId: payload.sub, username: payload.name };
  }

  private sign(data: string): string {
    return b64url(createHmac("sha256", this.secret).update(data).digest());
  }
}
