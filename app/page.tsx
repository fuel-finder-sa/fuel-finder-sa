"use client";

import { useEffect, useState } from "react";
import stationsData from "../stations_cleaned.json";

export default function Home() {
  const [stations, setStations] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [search, setSearch] = useState("");

  // 📍 Get user location
  const getLocation = () => {
    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    });
  };

  // 📏 Distance calculation
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 🔄 Load + calculate distances
  useEffect(() => {
    let updated = stationsData;

    if (userLocation) {
      updated = stationsData.map((s: any) => ({
        ...s,
        distance: getDistance(
          userLocation.lat,
          userLocation.lng,
          s.lat,
          s.lng
        ),
      }));

      updated.sort((a: any, b: any) => a.distance - b.distance);
    }

    setStations(updated);
  }, [userLocation]);

  // 🔍 SAFE SEARCH (FIXED)
  const filtered = stations.filter((s: any) =>
    `${s.name || ""} ${s.address || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      {/* HEADER */}
      <div className="bg-gray-900 text-white p-4 rounded-xl mb-4 shadow">
        <h1 className="text-xl font-bold">Fuel Finder SA</h1>
        <p className="text-sm text-gray-300">
          Compare fuel prices, distance and station features.
        </p>

        <button
          onClick={getLocation}
          className="mt-3 bg-green-500 text-white px-4 py-2 rounded-lg text-sm"
        >
          📍 Use My Location
        </button>
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search station, suburb, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 mb-4 rounded-lg border"
      />

      {/* STATIONS */}
      {filtered.map((station: any, index: number) => {
        const distance = station.distance
          ? station.distance.toFixed(1)
          : null;

        const mapsUrl = `https://www.google.com/maps?q=${station.lat},${station.lng}`;
        const callUrl = station.phone ? `tel:${station.phone}` : null;

        return (
          <div
            key={index}
            className="bg-white shadow-md rounded-2xl p-4 mb-4 border"
          >
            {/* NAME */}
            <h2 className="text-lg font-semibold">{station.name}</h2>

            {/* ADDRESS */}
            <p className="text-sm text-gray-500">
              {station.address || "No address"}
            </p>

            {/* DISTANCE */}
            {distance && (
              <p className="text-sm mt-1 text-blue-600">
                📍 {distance} km away
              </p>
            )}

            {/* PRICE */}
            {station.price && (
              <p className="text-sm mt-1 font-medium">
                💰 R{station.price}
              </p>
            )}

            {/* BUTTONS */}
            <div className="flex gap-2 mt-3">
              {/* NAVIGATE */}
              <a
                href={mapsUrl}
                target="_blank"
                className="flex-1 text-center bg-blue-600 text-white py-2 rounded-lg text-sm"
              >
                🧭 Navigate
              </a>

              {/* CALL */}
              {callUrl && (
                <a
                  href={callUrl}
                  className="flex-1 text-center bg-green-600 text-white py-2 rounded-lg text-sm"
                >
                  📞 Call
                </a>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}