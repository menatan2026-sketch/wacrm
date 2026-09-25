import Link from "next/link";
import { PageHeader } from "@/components/page/PageHeader";

export default function NotFound() {
  return (
    <div style={{ minHeight: "80vh" }}>
      <PageHeader index="404" title={["Off the map."]} lede="This page doesn't exist — but the car you're looking for might.">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/vehicles" className="btn btn-primary">
            Explore vehicles
          </Link>
          <Link href="/" className="btn btn-ghost">
            Back to start
          </Link>
        </div>
      </PageHeader>
    </div>
  );
}
