"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldAtlas from "world-atlas/countries-110m.json";
import { SEVERITY_COLOR, SOURCE_HOME, severityFor } from "@/lib/travel-meta";
import type { TravelCountry, TravelSourceId } from "@/types";

const WIDTH = 960;
const HEIGHT = 500;

// Shapes in the atlas without an ISO numeric id.
const ALIAS_KEYS: Record<string, string> = {
  Somaliland: "706",
  "N. Cyprus": "196",
  Kosovo: "XK",
};

interface MapShape {
  key: string;
  d: string;
  bounds: [[number, number], [number, number]];
}

interface Transform {
  k: number;
  x: number;
  y: number;
}

const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

function focusTransform(shape: MapShape): Transform {
  const [[bx0, y0], [bx1, y1]] = shape.bounds;
  let x0 = bx0;
  let x1 = bx1;
  // Russia and Fiji wrap around the antimeridian; fall back to a sensible box.
  if (x1 - x0 > WIDTH * 0.6) {
    x0 = WIDTH * 0.55;
    x1 = WIDTH * 0.98;
  }
  const k = Math.min(6, 0.7 / Math.max((x1 - x0) / WIDTH, (y1 - y0) / HEIGHT));
  return clampTransform({
    k,
    x: WIDTH / 2 - ((x0 + x1) / 2) * k,
    y: HEIGHT / 2 - ((y0 + y1) / 2) * k,
  });
}

function clampTransform(t: Transform): Transform {
  const k = Math.min(10, Math.max(1, t.k));
  const minX = WIDTH - WIDTH * k;
  const minY = HEIGHT - HEIGHT * k;
  return {
    k,
    x: Math.min(0, Math.max(minX, t.x)),
    y: Math.min(0, Math.max(minY, t.y)),
  };
}

const projection = geoNaturalEarth1().fitExtent(
  [
    [6, 6],
    [WIDTH - 6, HEIGHT - 6],
  ],
  { type: "Sphere" },
);
const pathGenerator = geoPath(projection);

function buildShapes(): { shapes: MapShape[]; sphere: string; graticule: string } {
  const topology = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>;
  const collection = feature(topology, topology.objects.countries) as FeatureCollection<
    Geometry,
    { name: string }
  >;

  const shapes = collection.features.map((item: Feature<Geometry, { name: string }>) => {
    const key = String(item.id ?? ALIAS_KEYS[item.properties.name] ?? item.properties.name);
    return {
      key,
      d: pathGenerator(item) ?? "",
      bounds: pathGenerator.bounds(item) as [[number, number], [number, number]],
    };
  });

  return {
    shapes,
    sphere: pathGenerator({ type: "Sphere" }) ?? "",
    graticule: pathGenerator(geoGraticule10()) ?? "",
  };
}

const MAP = buildShapes();

interface TravelMapProps {
  countries: TravelCountry[];
  view: TravelSourceId;
  selected: string | null;
  /** Bumped by the parent when the map should zoom to a country (list or search pick). */
  focus: { iso2: string; n: number } | null;
  /** Called with null when the ocean or a country without data is clicked. */
  onSelect: (iso2: string | null) => void;
  /** Details for the selected country, shown in a popup next to it. */
  popup?: ReactNode;
}

const POPUP_WIDTH = 296;
const POPUP_GAP = 10;

export function TravelMap({ countries, view, selected, focus, onSelect, popup }: TravelMapProps) {
  const { shapes, sphere, graticule } = MAP;
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [dragging, setDragging] = useState(false);
  // Popup anchor in untransformed map units, so it follows zoom and pan.
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(0);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onSelect(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, onSelect]);

  const byKey = useMemo(() => {
    const map = new Map<string, TravelCountry>();
    for (const country of countries) {
      map.set(country.numeric ?? country.iso2, country);
    }
    return map;
  }, [countries]);

  const selectedKey = useMemo(() => {
    const country = countries.find((item) => item.iso2 === selected);
    return country ? (country.numeric ?? country.iso2) : null;
  }, [countries, selected]);

  // Zoom when the parent requests focus (adjusting state during render, no effect needed).
  const [handledFocus, setHandledFocus] = useState<number | null>(null);
  if (focus && focus.n !== handledFocus) {
    setHandledFocus(focus.n);
    const country = countries.find((item) => item.iso2 === focus.iso2);
    const key = country ? (country.numeric ?? country.iso2) : null;
    const shape = key ? shapes.find((item) => item.key === key) : null;
    if (shape) {
      setTransform(focusTransform(shape));
      const [[x0, y0], [x1, y1]] = shape.bounds;
      setAnchor({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
    } else {
      // Too small for the 110m atlas (e.g. Singapore): the popup sits at the top instead.
      setAnchor(null);
    }
  }

  function zoomBy(factor: number) {
    setTransform((current) => {
      const k = current.k * factor;
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      return clampTransform({
        k,
        x: cx - ((cx - current.x) / current.k) * k,
        y: cy - ((cy - current.y) / current.k) * k,
      });
    });
  }

  function toSvgUnits(dx: number, dy: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    const scale = rect && rect.width > 0 ? WIDTH / rect.width : 1;
    return { dx: dx * scale, dy: dy * scale };
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || transform.k === 1) return;
    const { dx, dy } = toSvgUnits(event.clientX - drag.x, event.clientY - drag.y);
    if (Math.abs(dx) + Math.abs(dy) < 3 && !drag.moved) return;
    if (!drag.moved) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    drag.moved = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    setTransform((current) => clampTransform({ ...current, x: current.x + dx, y: current.y + dy }));
  }

  function onPointerUp() {
    setDragging(false);
    // Keep the flag until the click handler has run, then clear it.
    setTimeout(() => {
      dragRef.current = null;
    }, 0);
  }

  function handleShapeClick(event: MouseEvent<SVGPathElement>, key: string) {
    const country = byKey.get(key);
    if (!country) return;
    // Stop the click from reaching the svg, which would clear the selection again.
    event.stopPropagation();
    if (dragRef.current?.moved) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const scale = WIDTH / rect.width;
      setAnchor({
        x: ((event.clientX - rect.left) * scale - transform.x) / transform.k,
        y: ((event.clientY - rect.top) * scale - transform.y) / transform.k,
      });
    }
    onSelect(country.iso2);
  }

  function handleBackgroundClick() {
    if (dragRef.current?.moved) return;
    onSelect(null);
  }

  function popupStyle(): CSSProperties {
    const popupWidth = Math.min(POPUP_WIDTH, width - 16);
    const mapHeight = (width * HEIGHT) / WIDTH;
    const transition = dragging ? "none" : "left 350ms ease, top 350ms ease";

    // On phones the map is too small to place the popup beside a country; dock it below.
    if (width < 480) {
      return { width: width - 16, left: 8, top: mapHeight + 8 };
    }

    if (!anchor) {
      return { width: popupWidth, left: (width - popupWidth) / 2, top: 8, transition };
    }

    const scale = width / WIDTH;
    const x = (anchor.x * transform.k + transform.x) * scale;
    const y = Math.min(mapHeight, Math.max(0, (anchor.y * transform.k + transform.y) * scale));
    // Open towards the side of the map with more room.
    const above = y > mapHeight / 2;

    return {
      width: popupWidth,
      left: Math.min(width - popupWidth - 8, Math.max(8, x - popupWidth / 2)),
      top: above ? y - POPUP_GAP : y + POPUP_GAP,
      transform: above ? "translateY(-100%)" : undefined,
      transition,
    };
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative overflow-hidden rounded-2xl" style={{ background: "var(--map-ocean)" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={`block h-auto w-full touch-pan-y select-none ${transform.k > 1 ? "cursor-grab" : ""}`}
          role="img"
          aria-label="World map of travel advisories"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={handleBackgroundClick}
        >
          <g
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
            style={{ transition: dragging ? "none" : "transform 350ms ease" }}
          >
            <path d={sphere} fill="var(--map-ocean)" />
            <path
              d={graticule}
              fill="none"
              stroke="var(--grid)"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
            {shapes.map((shape, index) => {
              const country = byKey.get(shape.key);
              // The issuing country has no advisory about itself, so it is marked in blue.
              const fill =
                shape.key === SOURCE_HOME[view]
                  ? "var(--map-home)"
                  : SEVERITY_COLOR[severityFor(country, view)];
              return (
                <path
                  key={`${shape.key}-${index}`}
                  d={shape.d}
                  fill={fill}
                  stroke="var(--map-edge)"
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                  className={country ? "cursor-pointer transition-[fill] duration-200" : undefined}
                  onClick={(event) => handleShapeClick(event, shape.key)}
                >
                  {country ? <title>{country.name}</title> : null}
                </path>
              );
            })}
            {selectedKey
              ? shapes
                  .filter((shape) => shape.key === selectedKey)
                  .map((shape, index) => (
                    <path
                      key={`sel-${index}`}
                      d={shape.d}
                      fill="none"
                      stroke="var(--foreground)"
                      strokeWidth={1.6}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  ))
              : null}
          </g>
        </svg>

        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          {[
            { label: "+", aria: "Zoom in", action: () => zoomBy(1.6) },
            { label: "−", aria: "Zoom out", action: () => zoomBy(1 / 1.6) },
            { label: "⟲", aria: "Reset view", action: () => setTransform(IDENTITY) },
          ].map((button) => (
            <button
              key={button.aria}
              type="button"
              aria-label={button.aria}
              onClick={button.action}
              className="theme-panel theme-text flex h-8 w-8 items-center justify-center rounded-lg text-base font-semibold"
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      {selected && popup && width > 0 ? (
        <div role="dialog" aria-label="Country details" className="absolute z-20" style={popupStyle()}>
          {popup}
        </div>
      ) : null}
    </div>
  );
}
