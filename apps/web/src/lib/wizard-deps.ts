import "server-only";
import { randomBytes } from "node:crypto";
export { catalog, drafts, files } from "@mfg/core";

export const randomTokenForCookie = () => randomBytes(24).toString("base64url");
