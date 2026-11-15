import { SEVERITY_COLOR } from "@/lib/travel-meta";

export function Swatch({ severity, size = 10 }: { severity: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block flex-none rounded-[3px]"
      style={{
        width: size,
        height: size,
        background: SEVERITY_COLOR[severity as keyof typeof SEVERITY_COLOR],
      }}
    />
  );
}
