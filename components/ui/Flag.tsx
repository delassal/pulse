import { useId, type ReactNode } from "react";
import type { TravelSourceId } from "@/types";

// Flag artwork from flag-icons 7.2.3 (MIT, https://github.com/lipis/flag-icons), 4:3 ratio.
// Inlined instead of adding the package, since only a handful of flags are needed.
// The EU and China stars are flattened from the original <use> references so no ids are needed.

export type FlagCode = TravelSourceId | "eu" | "ru" | "cn";

// Five-pointed unit star (outer radius 1), shared by the EU and China flags.
const STAR_PATH = "M-.6.8 0-1 .6.8-1-.3h2z";

// Twelve upright stars on a circle of radius 6 units around the flag centre.
const EU_STAR_TRANSFORMS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  const x = 320 + 6 * 23.7037 * Math.sin(angle);
  const y = 242.3 - 6 * 23.7037 * Math.cos(angle);
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(23.7037)`;
});

const CN_STAR_TRANSFORMS = [
  "matrix(71.9991 0 0 72 120 120)",
  "matrix(-12.33562 -20.5871 20.58684 -12.33577 240.3 48)",
  "matrix(-3.38573 -23.75998 23.75968 -3.38578 288 95.8)",
  "matrix(6.5991 -23.0749 23.0746 6.59919 288 168)",
  "matrix(14.9991 -18.73557 18.73533 14.99929 240 216)",
];

function UsFlag({ markerId }: { markerId: string }) {
  return (
    <>
      <path fill="#bd3d44" d="M0 0h640v480H0" />
      <path
        stroke="#fff"
        strokeWidth="37"
        d="M0 55.3h640M0 129h640M0 203h640M0 277h640M0 351h640M0 425h640"
      />
      <path fill="#192f5d" d="M0 0h364.8v258.5H0" />
      <marker id={markerId} markerHeight="30" markerWidth="30">
        <path fill="#fff" d="m14 0 9 27L0 10h28L5 27z" />
      </marker>
      <path
        fill="none"
        markerMid={`url(#${markerId})`}
        d="m0 0 16 11h61 61 61 61 60L47 37h61 61 60 61L16 63h61 61 61 61 60L47 89h61 61 60 61L16 115h61 61 61 61 60L47 141h61 61 60 61L16 166h61 61 61 61 60L47 192h61 61 60 61L16 218h61 61 61 61 60z"
      />
    </>
  );
}

const FLAGS: Record<Exclude<FlagCode, "us">, ReactNode> = {
  eu: (
    <>
      <path fill="#039" d="M0 0h640v480H0z" />
      {EU_STAR_TRANSFORMS.map((transform) => (
        <path key={transform} fill="#fc0" transform={transform} d={STAR_PATH} />
      ))}
    </>
  ),
  ru: (
    <>
      <path fill="#fff" d="M0 0h640v160H0z" />
      <path fill="#0039a6" d="M0 160h640v160H0z" />
      <path fill="#d52b1e" d="M0 320h640v160H0z" />
    </>
  ),
  cn: (
    <>
      <path fill="#ee1c25" d="M0 0h640v480H0z" />
      {CN_STAR_TRANSFORMS.map((transform) => (
        <path key={transform} fill="#ff0" transform={transform} d={STAR_PATH} />
      ))}
    </>
  ),
  de: (
    <>
      <path fill="#fc0" d="M0 320h640v160H0z" />
      <path fill="#000001" d="M0 0h640v160H0z" />
      <path fill="red" d="M0 160h640v160H0z" />
    </>
  ),
  ca: (
    <>
      <path fill="#fff" d="M150.1 0h339.7v480H150z" />
      <path
        fill="#d52b1e"
        d="M-19.7 0h169.8v480H-19.7zm509.5 0h169.8v480H489.9zM201 232l-13.3 4.4 61.4 54c4.7 13.7-1.6 17.8-5.6 25l66.6-8.4-1.6 67 13.9-.3-3.1-66.6 66.7 8c-4.1-8.7-7.8-13.3-4-27.2l61.3-51-10.7-4c-8.8-6.8 3.8-32.6 5.6-48.9 0 0-35.7 12.3-38 5.8l-9.2-17.5-32.6 35.8c-3.5.9-5-.5-5.9-3.5l15-74.8-23.8 13.4c-2 .9-4 .1-5.2-2.2l-23-46-23.6 47.8c-1.8 1.7-3.6 1.9-5 .7L264 130.8l13.7 74.1c-1.1 3-3.7 3.8-6.7 2.2l-31.2-35.3c-4 6.5-6.8 17.1-12.2 19.5-5.4 2.3-23.5-4.5-35.6-7 4.2 14.8 17 39.6 9 47.7"
      />
    </>
  ),
  uk: (
    <>
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path
        fill="#FFF"
        d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z"
      />
      <path
        fill="#C8102E"
        d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z"
      />
      <path fill="#FFF" d="M241 0v480h160V0zM0 160v160h640V160z" />
      <path fill="#C8102E" d="M0 193v96h640v-96zM273 0v480h96V0z" />
    </>
  ),
};

export function Flag({ code, className }: { code: FlagCode; className?: string }) {
  const markerId = `flag-us-star${useId()}`;

  return (
    <svg
      viewBox="0 0 640 480"
      aria-hidden
      className={`inline-block flex-none overflow-hidden rounded-[3px] shadow-[0_0_0_1px_var(--border)] ${className ?? "h-3 w-4"}`}
    >
      {code === "us" ? <UsFlag markerId={markerId} /> : FLAGS[code]}
    </svg>
  );
}
