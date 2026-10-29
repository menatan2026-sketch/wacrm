import type { InvoiceProvider } from "../ports";

/**
 * Internal document register for development and the pilot. It numbers documents sequentially but
 * is NOT a certified Israeli tax-invoice system; a certified provider adapter must replace it
 * before public launch (KNOWN_ISSUES KI-007).
 */
export class InternalInvoiceProvider implements InvoiceProvider {
  readonly name = "internal";
  async issue(input: { kind: "receipt" | "credit_note"; sequence: number }): Promise<{ documentNumber: string }> {
    return { documentNumber: `${input.kind === "receipt" ? "RC" : "CN"}-${input.sequence}` };
  }
}
