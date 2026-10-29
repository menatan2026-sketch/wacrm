import type { ShipmentRequest, ShippingProvider } from "../ports";
import { randomDigits } from "../shared/crypto";

/**
 * Manual fallback (ADR-0011): ops books the courier outside the system and enters the carrier and
 * tracking number. Keeps operations running when no courier API is integrated or it is down.
 */
export class ManualShippingProvider implements ShippingProvider {
  readonly name = "manual";
  readonly automatic = false;
  async createShipment(): Promise<never> {
    throw new Error("manual shipments are entered by staff");
  }
  async trackShipment() {
    return [];
  }
}

/** Development courier that issues tracking numbers and walks shipments through their statuses. */
export class FakeShippingProvider implements ShippingProvider {
  readonly name = "fake";
  readonly automatic = true;
  private readonly progress = new Map<string, number>();
  private static readonly FLOW = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

  async createShipment(input: ShipmentRequest) {
    const trackingNumber = `FK${randomDigits(10)}`;
    this.progress.set(trackingNumber, 0);
    void input;
    return { carrier: "Fake Courier", trackingNumber, trackingUrl: null, costMinor: 2200 };
  }

  async trackShipment(trackingNumber: string) {
    const step = Math.min((this.progress.get(trackingNumber) ?? 0) + 1, FakeShippingProvider.FLOW.length);
    this.progress.set(trackingNumber, step);
    return FakeShippingProvider.FLOW.slice(0, step).map((status, i) => ({ status, providerEventId: `${trackingNumber}-${i}`, description: status, at: new Date() }));
  }
}
