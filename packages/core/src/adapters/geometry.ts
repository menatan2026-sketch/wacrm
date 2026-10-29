import type { GeometryClient, GeometryResult } from "../ports";

/** Client for services/geometry. The service is internal-only and authenticated by a shared secret. */
export class HttpGeometryClient implements GeometryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly sharedSecret: string,
    private readonly timeoutMs = 90_000,
  ) {}

  async analyze(fileName: string, bytes: Buffer): Promise<GeometryResult> {
    const res = await fetch(`${this.baseUrl}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "x-shared-secret": this.sharedSecret, "x-file-name": encodeURIComponent(fileName) },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.status === 401) throw new Error("geometry service rejected the shared secret");
    if (!res.ok && res.status !== 422) throw new Error(`geometry service returned ${res.status}`);
    return (await res.json()) as GeometryResult;
  }
}

/** Deterministic stand-in for tests: a 40 mm cube unless configured otherwise. */
export class FakeGeometryClient implements GeometryClient {
  next: GeometryResult | ((name: string) => GeometryResult) | null = null;
  calls: string[] = [];
  async analyze(fileName: string): Promise<GeometryResult> {
    this.calls.push(fileName);
    if (this.next) return typeof this.next === "function" ? this.next(fileName) : this.next;
    return FakeGeometryClient.cube(40);
  }
  static cube(side: number): GeometryResult {
    return {
      ok: true,
      analyzer_version: "fake-1",
      duration_ms: 5,
      stages: ["parse", "measure", "check_geometry", "printability", "volume"].map((stage) => ({ stage, status: "done" as const })),
      metrics: {
        units_detected: "mm",
        bbox_mm: [side, side, side],
        volume_mm3: side ** 3,
        surface_area_mm2: 6 * side ** 2,
        overhang_area_mm2: 0,
        triangle_count: 12,
        shells: 1,
        is_watertight: true,
      },
      warnings: [],
      preview_glb_b64: null,
    };
  }
}
