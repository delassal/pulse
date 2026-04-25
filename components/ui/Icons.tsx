import type { SVGProps } from "react";

function baseProps(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function UsOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3.8 8.2 6.1 6.4h4.1l1.2 1.4 2.2-.7 1.8 1.3 2.1-.3 1.9 1.8.2 2.2-1.1 1.1-.1 1.8-2.2.8-1.1 1.8-2.5-.2-1.5 1-2.2-.7-1.9.5-1.6-1.1-1.5.1-1-1.8.2-1.8-.9-1.6.6-1.7z" />
    </svg>
  );
}

export function EuropeOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M5.2 8.2 7.1 6.1h2.4l1.2 1 1.6-.4 1.2 1.1 1.5-.2 1.3 1.4-.2 1.7 1 1.1-.4 1.7-1.8.6-.7 1.3-1.9.4-.9 1.1-1.8-.5-1.1-1.3-1.6-.4-1.1-1.5-.9-.1-.7-1.7.4-1.4.7-1.3z" />
    </svg>
  );
}

export function AsiaOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M7 6.6 9.3 5.3l2.5.6 1.4 1.2 2-.3 1.7 1.8-.2 1.4 1.3 1.2-.5 1.8-1.7 1.1-.4 1.6-1.9.6-1 .9-2.1-.4-1.1-1.5-1.7-.5-1.3-1.7-1-.2-.7-1.6.6-1.9 1.1-1.5z" />
      <path d="M13.2 8.7 15.4 7.8" />
    </svg>
  );
}

export function FinancialsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 19.5h16" />
      <path d="M6.5 15.5v-4" />
      <path d="M11 15.5v-7" />
      <path d="M15.5 15.5v-5.5" />
      <path d="M6 10.5 11 8l4 1.5 3-3" />
    </svg>
  );
}

export function PersonalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M6 19c0-3.3 2.7-5 6-5s6 1.7 6 5" />
    </svg>
  );
}

export function MacroIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 17.5h16" />
      <path d="M6 14.5V9" />
      <path d="M10 14.5V6.5" />
      <path d="M14 14.5V11" />
      <path d="M18 14.5V8" />
    </svg>
  );
}

export function WeatherIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M7.5 15.5a4 4 0 1 1 .9-7.9 5.2 5.2 0 0 1 9.3 2.4 3.2 3.2 0 0 1-.2 6.4H7.5Z" />
      <path d="M9.5 18.5h5" />
    </svg>
  );
}

export function GymIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M6.5 9.5v5" />
      <path d="M17.5 9.5v5" />
      <path d="M4.5 12h15" />
      <path d="M8 8.5v7" />
      <path d="M16 8.5v7" />
    </svg>
  );
}

export function UkOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12.3 5.2 10.9 6l.2 1.5-1.1.7.2 1.8-.9 1 .3 1.9-.7 1.2.4 1.6 1.3.9 1.4-.6.9-1.3-.2-1.6.8-1.2-.1-1.5.8-1.4-.5-1.8-1-1.2Z" />
      <path d="m13.7 15.8 1.1.9-.2 1.1-1 .4-.9-.8.2-.9z" />
    </svg>
  );
}

export function RussiaOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4.2 10.2 6 8.4h3.2l1.7-.8 2.6.7h2.9l1.8 1.4 1.7-.1 1.3 1.4-.5 1.5-2.1.6-1.7 1.2-2.6-.1-1.9 1-2.8-.3-1.4 1.1-2.3-.2-1.4-1.5.5-1.6-1.1-1.5z" />
    </svg>
  );
}

export function ChinaOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps(props)}>
      <path d="M6.4 7.4 8.8 6l2 .9 1.7-.4 1.4 1 2-.2 1.6 1.5-.1 1.8 1 1-.5 1.9-1.8.9-.6 1.6-1.8.6-1 1.1-2-.4-1.3-1.4-1.8-.6-1.1-1.7-.9-.1-.6-1.7.6-1.7 1.3-1.4z" />
      <path d="M15.5 15.8 16.6 17l-.4 1.1-1.1.2-.8-.8.2-1z" />
    </svg>
  );
}
