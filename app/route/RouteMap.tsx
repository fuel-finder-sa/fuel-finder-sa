"use client";

import dynamic from "next/dynamic";
import type { RouteStop } from "./page";

type Point = { lat: number; lng: number };
type Props = { routeLine: Point[]; from: Point; to: Point; stops: RouteStop[] };

const RouteMapClient = dynamic(() => import("./RouteMapClient"), {
  ssr: false,
  loading: () => <div style={{ height: 420, background: "#e2e8f0", borderRadius: 12, display: "grid", placeItems: "center" }}>Loading route map...</div>,
});

export default function RouteMap(props: Props) {
  return <RouteMapClient {...props} />;
}
