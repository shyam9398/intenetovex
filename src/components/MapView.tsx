import React, { forwardRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAppState, type LatLng } from "@/contexts/AppStateContext";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
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

const createJunctionIcon = (signalStatus: "red" | "green") => {
  const color = signalStatus === "red" ? "hsl(0,72%,51%)" : "hsl(142,70%,45%)";
  const glow = signalStatus === "red" ? "rgba(220,38,38,0.6)" : "rgba(34,197,94,0.4)";
  const emoji = signalStatus === "red" ? "🔴" : "🟢";

  return new L.DivIcon({
    html: `<div style="background:${color};width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;border:2px solid hsl(0,0%,100%);box-shadow:0 0 10px ${glow};font-size:11px;">${emoji}</div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

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
    click(event) {
      onClick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
};

const FlyToLocation: React.FC<{ center: LatLng | null }> = ({ center }) => {
  const map = useMap();

  React.useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 15), { duration: 1 });
    }
  }, [center, map]);

  return null;
};

interface MapViewProps {
  onMapClick?: (latlng: LatLng) => void;
  onJunctionClick?: (junctionId: string) => void;
  showAmbulances?: boolean;
  driverAmbulanceId?: string | null;
  center?: LatLng;
  searchQuery?: string;
  flyToCenter?: LatLng | null;
}

const MapView = forwardRef<HTMLDivElement, MapViewProps>(({
  onMapClick,
  onJunctionClick,
  showAmbulances = true,
  driverAmbulanceId,
  center = { lat: 12.9716, lng: 77.5946 },
  searchQuery = "",
  flyToCenter = null,
}, ref) => {
  const { junctions, geofences, hospitals, ambulances } = useAppState();

  const displayAmbulances = showAmbulances
    ? ambulances.filter((ambulance) => ambulance.active)
    : driverAmbulanceId
      ? ambulances.filter((ambulance) => ambulance.id === driverAmbulanceId && ambulance.active)
      : [];

  const filteredJunctions = useMemo(() => {
    if (!searchQuery.trim()) return junctions;
    const query = searchQuery.toLowerCase();
    return junctions.filter((junction) => junction.name.toLowerCase().includes(query));
  }, [junctions, searchQuery]);

  const headingToLabel = (deg: number) => {
    if (deg >= 315 || deg < 45) return "N";
    if (deg >= 45 && deg < 135) return "E";
    if (deg >= 135 && deg < 225) return "S";
    return "W";
  };

  return (
    <div ref={ref} className="w-full h-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        className="w-full h-full rounded-lg"
        style={{ minHeight: "400px" }}
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {onMapClick && <MapClickHandler onClick={onMapClick} />}
        {flyToCenter && <FlyToLocation center={flyToCenter} />}

        {geofences.map((geofence) => (
          <Circle
            key={geofence.id}
            center={[geofence.center.lat, geofence.center.lng]}
            radius={geofence.radius}
            pathOptions={{
              color: geofence.triggered ? "hsl(0,72%,51%)" : "hsl(38,92%,50%)",
              fillColor: geofence.triggered ? "hsl(0,72%,51%)" : "hsl(38,92%,50%)",
              fillOpacity: geofence.triggered ? 0.25 : 0.1,
              weight: 2,
              dashArray: geofence.triggered ? undefined : "6 4",
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{geofence.name}</strong>
                <br />
                Radius: {geofence.radius}m
                <br />
                Status: {geofence.triggered ? "⚠️ TRIGGERED" : "Monitoring"}
              </div>
            </Popup>
          </Circle>
        ))}

        {filteredJunctions.map((junction) => (
          <Marker key={junction.id} position={[junction.position.lat, junction.position.lng]} icon={createJunctionIcon(junction.signalStatus)}>
            <Popup>
              <div className="text-sm">
                <strong>{junction.name}</strong>
                <br />
                Signal: {junction.signalStatus === "red" ? "🔴 RED — Ambulance nearby" : "🟢 GREEN — Clear"}
                {onJunctionClick && (
                  <>
                    <br />
                    <button
                      onClick={() => onJunctionClick(junction.id)}
                      style={{
                        marginTop: "6px",
                        padding: "4px 10px",
                        background: "hsl(221,83%,53%)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                        width: "100%",
                      }}
                    >
                      🔲 View 3D Map
                    </button>
                  </>
                )}
              </div>
            </Popup>
            {onJunctionClick && (
              <Tooltip direction="right" offset={[14, 0]} permanent interactive>
                <button
                  onClick={(e) => { e.stopPropagation(); onJunctionClick(junction.id); }}
                  style={{
                    padding: "2px 6px",
                    background: "hsl(221,83%,53%)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  3D
                </button>
              </Tooltip>
            )}
          </Marker>
        ))}

        {hospitals.map((hospital) => (
          <Marker key={hospital.id} position={[hospital.position.lat, hospital.position.lng]} icon={hospitalIcon}>
            <Popup>
              <strong>{hospital.name}</strong>
              <br />
              Hospital
            </Popup>
          </Marker>
        ))}

        {displayAmbulances.map((ambulance) => (
          <Marker key={ambulance.id} position={[ambulance.position.lat, ambulance.position.lng]} icon={ambulanceIcon}>
            <Popup>
              <div className="text-sm">
                <strong>🚑 {ambulance.driverName}</strong>
                <br />
                Speed: {ambulance.speed.toFixed(0)} km/h
                <br />
                Approach: {headingToLabel(ambulance.heading)}
                <br />
                Exit: {ambulance.exitDirection ?? "Not set"}
                <br />
                ETA: {ambulance.eta ? `${Math.round(ambulance.eta)}s` : "N/A"}
                <br />
                Priority: #{ambulance.priority || "—"}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
});

MapView.displayName = "MapView";

export default MapView;
