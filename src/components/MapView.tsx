import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAppState, type LatLng } from "@/contexts/AppStateContext";

// Fix default marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const ambulanceIcon = new L.DivIcon({
  html: `<div style="background:hsl(0,72%,51%);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid hsl(0,0%,100%);box-shadow:0 0 12px rgba(220,38,38,0.6);font-size:14px;">🚑</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const junctionIcon = new L.DivIcon({
  html: `<div style="background:hsl(38,92%,50%);width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;border:2px solid hsl(0,0%,100%);font-size:10px;">⚡</div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const hospitalIcon = new L.DivIcon({
  html: `<div style="background:hsl(142,70%,45%);width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid hsl(0,0%,100%);font-size:12px;">🏥</div>`,
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface MapClickHandlerProps {
  onClick?: (latlng: LatLng) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

interface MapViewProps {
  onMapClick?: (latlng: LatLng) => void;
  showAmbulances?: boolean;
  driverAmbulanceId?: string | null;
  center?: LatLng;
}

const MapView: React.FC<MapViewProps> = ({
  onMapClick,
  showAmbulances = true,
  driverAmbulanceId,
  center = { lat: 12.9716, lng: 77.5946 },
}) => {
  const { junctions, geofences, hospitals, ambulances } = useAppState();

  const displayAmbulances = showAmbulances
    ? ambulances.filter((a) => a.active)
    : driverAmbulanceId
    ? ambulances.filter((a) => a.id === driverAmbulanceId)
    : [];

  const headingToLabel = (deg: number) => {
    if (deg >= 315 || deg < 45) return "N";
    if (deg >= 45 && deg < 135) return "E";
    if (deg >= 135 && deg < 225) return "S";
    return "W";
  };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      className="w-full h-full rounded-lg"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <MapClickHandler onClick={onMapClick} />}

      {/* Geofences */}
      {geofences.map((gf) => (
        <Circle
          key={gf.id}
          center={[gf.center.lat, gf.center.lng]}
          radius={gf.radius}
          pathOptions={{
            color: gf.triggered ? "hsl(0,72%,51%)" : "hsl(38,92%,50%)",
            fillColor: gf.triggered ? "hsl(0,72%,51%)" : "hsl(38,92%,50%)",
            fillOpacity: gf.triggered ? 0.25 : 0.1,
            weight: 2,
            dashArray: gf.triggered ? undefined : "6 4",
          }}
        >
          <Popup>
            <div className="text-sm">
              <strong>{gf.name}</strong>
              <br />
              Radius: {gf.radius}m
              <br />
              Status: {gf.triggered ? "⚠️ TRIGGERED" : "Monitoring"}
            </div>
          </Popup>
        </Circle>
      ))}

      {/* Junctions */}
      {junctions.map((j) => (
        <Marker key={j.id} position={[j.position.lat, j.position.lng]} icon={junctionIcon}>
          <Popup>
            <strong>{j.name}</strong>
            <br />
            Junction Point
          </Popup>
        </Marker>
      ))}

      {/* Hospitals */}
      {hospitals.map((h) => (
        <Marker key={h.id} position={[h.position.lat, h.position.lng]} icon={hospitalIcon}>
          <Popup>
            <strong>{h.name}</strong>
            <br />
            Hospital
          </Popup>
        </Marker>
      ))}

      {/* Ambulances */}
      {displayAmbulances.map((amb) => (
        <Marker key={amb.id} position={[amb.position.lat, amb.position.lng]} icon={ambulanceIcon}>
          <Popup>
            <div className="text-sm">
              <strong>🚑 {amb.driverName}</strong>
              <br />
              Speed: {amb.speed.toFixed(0)} km/h
              <br />
              Approach: {headingToLabel(amb.heading)}
              <br />
              Exit: {amb.exitDirection ?? "Not set"}
              <br />
              ETA: {amb.eta ? `${Math.round(amb.eta)}s` : "N/A"}
              <br />
              Priority: #{amb.priority || "—"}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapView;
