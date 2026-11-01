"use client";

import dynamic from "next/dynamic";

const FuelMapClient = dynamic(
  () => import("./FuelMapClient"),
  {
    ssr: false,
  }
);

export default function FuelMap(props: any) {
  return <FuelMapClient {...props} />;
}