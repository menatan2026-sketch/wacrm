import type { DbOrTx, Role, Surface } from "@mfg/db";

export interface RoleGrant {
  role: Role;
  scopeType: "platform" | "supplier" | "organization";
  scopeId: string | null;
}

export type Actor =
  | {
      kind: "user";
      userId: string;
      email: string;
      locale: string;
      roles: RoleGrant[];
      sessionId: string;
      surface: Surface;
      mfaVerified: boolean;
    }
  | { kind: "guest"; anonKey: string | null }
  | { kind: "system"; name: string };

export type UserActor = Extract<Actor, { kind: "user" }>;

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Per-call context handed to every application command and query. */
export interface Ctx {
  db: DbOrTx;
  actor: Actor;
  clock: Clock;
  requestId?: string;
  /** True when `db` is already a transaction handle. */
  inTransaction?: boolean;
}

export const actorId = (actor: Actor): string | null =>
  actor.kind === "user" ? actor.userId : null;
export const actorType = (actor: Actor): "user" | "system" | "guest" => actor.kind;

export const SYSTEM: Actor = { kind: "system", name: "system" };
