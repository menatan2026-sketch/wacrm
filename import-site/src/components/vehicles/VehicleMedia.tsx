import Image from "next/image";
import type { Vehicle } from "@/domain/types";
import { StudioPlate } from "./StudioPlate";

/** Real photography when we have it, the studio plate when we don't. */
export function VehicleMedia({
  vehicle,
  className,
  variant = "card",
  priority = false,
  sizes = "(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 33vw",
}: {
  vehicle: Vehicle;
  className?: string;
  variant?: "card" | "hero";
  priority?: boolean;
  sizes?: string;
}) {
  const img = vehicle.images[0];
  if (img) {
    return (
      <Image
        src={img.src}
        alt={img.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        style={{ objectFit: "cover", objectPosition: img.focus ?? "50% 55%" }}
      />
    );
  }
  return <StudioPlate vehicle={vehicle} className={className} variant={variant} />;
}
