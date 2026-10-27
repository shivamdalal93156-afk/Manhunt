import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GPSLocation } from '@/types/geo';
import Svg, { Polygon, Line as SvgLine } from 'react-native-svg';
import { borderRadius, colors, spacing } from '@/theme/tokens';
import { PlusIcon, MinusIcon, TargetIcon } from '@/components/ui/Icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const MAP_CONTAINER_SIZE = Math.min(SCREEN_WIDTH - spacing.lg * 2, 350);

export type MapViewMode = 'street' | 'satellite';

export interface MapPlayerMarker {
  id: string;
  name: string;
  role: 'HUNTER' | 'RUNNER' | 'REFEREE';
  latitude: number;
  longitude: number;
  isSelf?: boolean;
  status?: string;
  distanceMeters?: number;
}

interface LivePlayZoneMapProps {
  currentLocation: GPSLocation | null;
  zoneRadius?: number; // in meters (default 500)
  onRecenter?: (lat: number, lng: number) => void;
  players?: MapPlayerMarker[];
  permissionDenied?: boolean;
  onRetryPermission?: () => void;
  height?: number;
  interactive?: boolean;
  customCenter?: { latitude: number; longitude: number } | null;
  onSelectCenter?: (coords: { latitude: number; longitude: number }) => void;
  allowTapToSelectCenter?: boolean;
  onChangeRadius?: (newRadius: number) => void;
  dynamicNextSafeCircle?: { center: { latitude: number; longitude: number }; radiusMeters: number } | null;
  dynamicNextSafePolygon?: { latitude: number; longitude: number }[] | null;
  dynamicPhaseText?: string | null;
  fullScreen?: boolean;
  viewMode?: MapViewMode;
  onViewModeChange?: (mode: MapViewMode) => void;
  hideModeToggle?: boolean;
  zoneMode?: 'CIRCLE' | 'POLYGON' | 'NONE';
  polygonVertices?: { latitude: number; longitude: number }[];
  onAddVertex?: (coords: { latitude: number; longitude: number }) => void;
}

export const LivePlayZoneMap: React.FC<LivePlayZoneMapProps> = ({
  currentLocation,
  zoneRadius = 500,
  onRecenter,
  players = [],
  permissionDenied = false,
  onRetryPermission,
  height = MAP_CONTAINER_SIZE,
  interactive = true,
  customCenter = null,
  onSelectCenter,
  allowTapToSelectCenter = false,
  onChangeRadius,
  dynamicNextSafeCircle = null,
  dynamicNextSafePolygon = null,
  dynamicPhaseText = null,
  fullScreen = false,
  viewMode: controlledViewMode,
  onViewModeChange,
  hideModeToggle = false,
  zoneMode = 'CIRCLE',
  polygonVertices = [],
  onAddVertex,
}) => {
  // Map View Mode: Street vs Satellite
  const [internalViewMode, setInternalViewMode] = useState<MapViewMode>('satellite');
  const viewMode = controlledViewMode !== undefined ? controlledViewMode : internalViewMode;

  // Zoom level: 13 (district overview) to 18 (street-level tactical detail)
  // Default to 17 for crisp building-level tactical gameplay
  const [zoom, setZoom] = useState(17);
  // Tile loading errors fallback
  const [tileErrorMap, setTileErrorMap] = useState<Record<string, boolean>>({});

  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // Pan offsets in pixels from center
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const currentPanRef = useRef({ x: 0, y: 0 });

  // Map container reference & window-relative layout tracking for sub-pixel touch accuracy
  const mapContainerRef = useRef<View>(null);
  const containerLayoutRef = useRef<{ pageX: number; pageY: number; width: number; height: number }>({
    pageX: 0,
    pageY: 0,
    width: fullScreen ? SCREEN_WIDTH : MAP_CONTAINER_SIZE,
    height: fullScreen ? SCREEN_HEIGHT : height,
  });

  const updateContainerLayout = () => {
    mapContainerRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) {
        containerLayoutRef.current = { pageX: x, pageY: y, width: w, height: h };
      }
    });
  };

  // Multi-touch pinch-to-zoom refs
  const pinchStartDistRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  // Slippy base anchor: center around custom chosen anchor if set, else live GPS, else Delhi default
  const baseLat = customCenter ? customCenter.latitude : (currentLocation?.latitude ?? 28.6139);
  const baseLon = customCenter ? customCenter.longitude : (currentLocation?.longitude ?? 77.2090);
  const accuracy = currentLocation?.accuracy;
  const isAcquiring = !currentLocation && !permissionDenied && !customCenter;

  const maxAllowedZoom = mapboxToken ? 19 : viewMode === 'satellite' ? 18 : 17;

  // Calculate meters per pixel at current latitude and zoom
  const metersPerPixel = useMemo(() => {
    return (
      (156543.03392 * Math.cos((baseLat * Math.PI) / 180)) / Math.pow(2, zoom)
    );
  }, [baseLat, zoom]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          return (
            interactive &&
            ((evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) ||
              Math.abs(gestureState.dx) > 2 ||
              Math.abs(gestureState.dy) > 2)
          );
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (evt) => {
          touchStartTimeRef.current = Date.now();
          panStartRef.current = { ...currentPanRef.current };
          updateContainerLayout();

          if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
            const [t1, t2] = evt.nativeEvent.touches;
            pinchStartDistRef.current = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          } else {
            pinchStartDistRef.current = null;
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            // Multi-touch pinch-to-zoom in & out
            const [t1, t2] = touches;
            const currentDist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
            if (pinchStartDistRef.current === null) {
              pinchStartDistRef.current = currentDist;
            } else {
              const diff = currentDist - pinchStartDistRef.current;
              if (diff > 25) {
                // Fingers separating: Zoom in
                setZoom((z) => Math.min(z + 1, maxAllowedZoom));
                pinchStartDistRef.current = currentDist;
              } else if (diff < -25) {
                // Fingers contracting: Zoom out (allow down to level 6 for 400km zones)
                setZoom((z) => Math.max(z - 1, 6));
                pinchStartDistRef.current = currentDist;
              }
            }
          } else if (!touches || touches.length === 1) {
            // Single finger pan
            const nextX = panStartRef.current.x + gestureState.dx;
            const nextY = panStartRef.current.y + gestureState.dy;
            currentPanRef.current = { x: nextX, y: nextY };
            setPanOffset({ x: nextX, y: nextY });
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          pinchStartDistRef.current = null;
          const touchDuration = Date.now() - touchStartTimeRef.current;
          const distMoved = Math.hypot(gestureState.dx, gestureState.dy);

          // Fast tap detection for custom map center selection
          if (touchDuration < 400 && distMoved < 12) {
            const tapX = evt.nativeEvent.locationX;
            const tapY = evt.nativeEvent.locationY;

            const mapW = containerLayoutRef.current.width || MAP_CONTAINER_SIZE;
            const mapH = containerLayoutRef.current.height || height;

            // Invert using exact Web Mercator spherical projection (100% matched to slippy map tiles)
            const n = Math.pow(2, zoom);
            const worldW = 256 * n;

            // Center position in world pixels
            const centerWorldX = ((baseLon + 180) / 360) * worldW;
            const baseLatRad = (baseLat * Math.PI) / 180;
            const centerWorldY =
              ((1 - Math.log(Math.tan(baseLatRad) + 1 / Math.cos(baseLatRad)) / Math.PI) / 2) *
              worldW;

            // Tapped pixel in world coordinates (taking current pan into account)
            const tapWorldX = centerWorldX + (tapX - mapW / 2 - currentPanRef.current.x);
            const tapWorldY = centerWorldY + (tapY - mapH / 2 - currentPanRef.current.y);

            // Invert to GPS longitude
            let clickedLon = (tapWorldX / worldW) * 360 - 180;
            clickedLon = ((((clickedLon + 180) % 360) + 360) % 360) - 180;

            // Invert to GPS latitude (inverse Gudermannian function)
            const yNorm = 0.5 - tapWorldY / worldW;
            const clickedLat =
              (90 - (360 * Math.atan(Math.exp(-yNorm * 2 * Math.PI))) / Math.PI);

            if (allowTapToSelectCenter && onSelectCenter) {
              onSelectCenter({ latitude: clickedLat, longitude: clickedLon });
            }
          }
        },
      }),
    [interactive, baseLat, baseLon, zoom, maxAllowedZoom, height, allowTapToSelectCenter, onSelectCenter]
  );

  // Radius of the play zone on canvas in pixels
  const zoneRadiusPx = useMemo(() => {
    return zoneRadius / metersPerPixel;
  }, [zoneRadius, metersPerPixel]);

  // Visual accuracy confidence halo radius in pixels
  const accuracyRadiusPx = useMemo(() => {
    if (!accuracy) return 14;
    return Math.max(10, Math.min(accuracy / metersPerPixel, height / 2));
  }, [accuracy, metersPerPixel, height]);

  // Slippy Map Tiles generation (dynamically calculated for viewport to minimize tile calls)
  const { tiles, centerOffsetX, centerOffsetY } = useMemo(() => {
    const n = Math.pow(2, zoom);
    const centerTileXExact = ((baseLon + 180) / 360) * n;
    const latRad = (baseLat * Math.PI) / 180;
    const centerTileYExact =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n;

    const baseTileX = Math.floor(centerTileXExact);
    const baseTileY = Math.floor(centerTileYExact);

    // Sub-tile pixel offset from tile top-left to center position
    const offsetX = (centerTileXExact - baseTileX) * 256;
    const offsetY = (centerTileYExact - baseTileY) * 256;

    const mapW = containerLayoutRef.current.width || (fullScreen ? SCREEN_WIDTH : MAP_CONTAINER_SIZE);
    const mapH = containerLayoutRef.current.height || (fullScreen ? SCREEN_HEIGHT : height);

    // Lower API calls: calculate exact viewport tile bounds + 1 buffer tile instead of arbitrary 5x5
    const halfSpanX = Math.min(3, Math.max(1, Math.ceil(mapW / 512)));
    const halfSpanY = Math.min(3, Math.max(1, Math.ceil(mapH / 512)));

    const tileList: Array<{
      key: string;
      x: number;
      y: number;
      streetUrl: string;
      satUrl: string;
      labelUrl: string;
      fallbackUrl: string;
    }> = [];

    for (let dx = -halfSpanX; dx <= halfSpanX; dx++) {
      for (let dy = -halfSpanY; dy <= halfSpanY; dy++) {
        const tx = (baseTileX + dx + n) % n;
        const ty = baseTileY + dy;
        if (ty >= 0 && ty < n) {
          // Google Maps standard road view vs Mapbox
          const streetUrl = mapboxToken
            ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/${zoom}/${tx}/${ty}@2x?access_token=${mapboxToken}`
            : `https://mt1.google.com/vt/lyrs=m&x=${tx}&y=${ty}&z=${zoom}`;

          // Google Hybrid: satellite + roads & labels bundled in a single composite tile (50% fewer requests)
          const satUrl = mapboxToken
            ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/${zoom}/${tx}/${ty}@2x?access_token=${mapboxToken}`
            : `https://mt1.google.com/vt/lyrs=y&x=${tx}&y=${ty}&z=${zoom}`;

          // Standalone label overlay only needed when base imagery has no labels
          const labelUrl = mapboxToken ? '' : '';

          // Secondary resilient fallback (ArcGIS) if Google CDN encounters rate-limits
          const fallbackUrl =
            viewMode === 'satellite'
              ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`
              : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${tx}`;

          tileList.push({
            key: `${zoom}-${tx}-${ty}`,
            x: dx,
            y: dy,
            streetUrl,
            satUrl,
            labelUrl,
            fallbackUrl,
          });
        }
      }
    }

    return {
      tiles: tileList,
      centerOffsetX: offsetX,
      centerOffsetY: offsetY,
    };
  }, [baseLat, baseLon, zoom, mapboxToken, viewMode, fullScreen, height]);

  // Convert GPS coordinates to screen pixel offsets relative to map center using exact Web Mercator
  const getPixelCoord = (targetLat: number, targetLon: number) => {
    const n = Math.pow(2, zoom);
    const worldW = 256 * n;

    const targetWorldX = ((targetLon + 180) / 360) * worldW;
    const targetLatRad = (targetLat * Math.PI) / 180;
    const targetWorldY =
      ((1 - Math.log(Math.tan(targetLatRad) + 1 / Math.cos(targetLatRad)) / Math.PI) / 2) *
      worldW;

    const centerWorldX = ((baseLon + 180) / 360) * worldW;
    const baseLatRad = (baseLat * Math.PI) / 180;
    const centerWorldY =
      ((1 - Math.log(Math.tan(baseLatRad) + 1 / Math.cos(baseLatRad)) / Math.PI) / 2) *
      worldW;

    const mapW = containerLayoutRef.current.width || (fullScreen ? SCREEN_WIDTH : MAP_CONTAINER_SIZE);
    const mapH = containerLayoutRef.current.height || (fullScreen ? SCREEN_HEIGHT : height);

    const pxX = mapW / 2 + (targetWorldX - centerWorldX) + panOffset.x;
    const pxY = mapH / 2 + (targetWorldY - centerWorldY) + panOffset.y;

    return { x: pxX, y: pxY };
  };

  // Coordinates of the zone center
  const zoneCenterPx = getPixelCoord(baseLat, baseLon);
  // Self position if GPS location is active
  const selfLat = currentLocation?.latitude ?? baseLat;
  const selfLon = currentLocation?.longitude ?? baseLon;
  const selfPx = getPixelCoord(selfLat, selfLon);

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 1, maxAllowedZoom));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z - 1, 6));
  };

  const handleSelectMode = (mode: MapViewMode) => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
    if (!mapboxToken && mode === 'street' && zoom > 17) {
      setZoom(17);
    }
  };

  const handleRecenter = () => {
    currentPanRef.current = { x: 0, y: 0 };
    setPanOffset({ x: 0, y: 0 });
    if (currentLocation && onRecenter) {
      onRecenter(currentLocation.latitude, currentLocation.longitude);
    }
  };

  const getAccuracyQuality = () => {
    if (permissionDenied) {
      return { text: 'GPS DENIED', color: colors.status.danger };
    }
    if (!accuracy) return { text: 'ACQUIRING...', color: colors.status.warning };
    if (accuracy <= 5) return { text: 'HIGH PRECISION 3D FIX', color: colors.status.safe };
    if (accuracy <= 15) return { text: 'HIGH PRECISION GPS', color: colors.runner.primary };
    return { text: 'STANDARD FIX', color: colors.status.warning };
  };

  const quality = getAccuracyQuality();

  const mapW = containerLayoutRef.current.width || (fullScreen ? SCREEN_WIDTH : MAP_CONTAINER_SIZE);
  const mapH = containerLayoutRef.current.height || (fullScreen ? SCREEN_HEIGHT : height);

  return (
    <View style={fullScreen ? styles.outerWrapperFullScreen : styles.outerWrapper}>
      {/* Top Map View Mode Selector (Standard Street vs Satellite Imagery) */}
      {!hideModeToggle && (
        <View style={styles.modeToggleBar}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'street' && styles.modeButtonActiveStreet,
            ]}
            onPress={() => handleSelectMode('street')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeButtonText,
                viewMode === 'street' && styles.modeButtonTextActive,
              ]}
            >
              🗺️ STREET MAP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              viewMode === 'satellite' && styles.modeButtonActiveSat,
            ]}
            onPress={() => handleSelectMode('satellite')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeButtonText,
                viewMode === 'satellite' && styles.modeButtonTextActive,
              ]}
            >
              🛰️ SATELLITE
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map Viewport Container */}
      <View
        ref={mapContainerRef}
        onLayout={updateContainerLayout}
        style={[
          styles.mapContainer,
          fullScreen
            ? styles.mapContainerFullScreen
            : { width: MAP_CONTAINER_SIZE, height },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Slippy Map Base Layer */}
        <View style={styles.tilesLayer} pointerEvents="none">
          {tiles.map((tile) => {
            const left =
              mapW / 2 +
              tile.x * 256 -
              centerOffsetX +
              panOffset.x;
            const top =
              mapH / 2 +
              tile.y * 256 -
              centerOffsetY +
              panOffset.y;

            // Only render visible tiles
            if (
              left < -256 ||
              left > mapW + 256 ||
              top < -256 ||
              top > mapH + 256
            ) {
              return null;
            }

            const hasError = tileErrorMap[tile.key];
            const baseUri = hasError
              ? tile.fallbackUrl
              : viewMode === 'satellite'
              ? tile.satUrl
              : tile.streetUrl;

            return (
              <React.Fragment key={tile.key}>
                {/* Base Imagery (Satellite or Street) */}
                <Image
                  source={{ uri: baseUri }}
                  style={[styles.tileImage, { left, top }]}
                  onError={() => {
                    setTileErrorMap((prev) => ({ ...prev, [tile.key]: true }));
                  }}
                />

                {/* Satellite Mode: Crisp Road & Place Labels Overlay (if non-composite provider) */}
                {viewMode === 'satellite' && !hasError && !!tile.labelUrl && (
                  <Image
                    source={{ uri: tile.labelUrl }}
                    style={[styles.tileImage, { left, top, zIndex: 2 }]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Tactical Coordinate Crosshairs */}
        <View style={styles.crosshairH} pointerEvents="none" />
        <View style={styles.crosshairV} pointerEvents="none" />

        {/* Instructional Banner for Custom Center Selection & Pinch Zoom */}
        {allowTapToSelectCenter && (
          <View style={styles.tapInstructionBanner} pointerEvents="none">
            <Text style={styles.tapInstructionText}>
              🎯 TAP MAP TO SET ANCHOR • PINCH TO ZOOM
            </Text>
          </View>
        )}

        {/* Dynamic Safe Zone Battle Royale Status Banner */}
        {dynamicPhaseText && (
          <View style={styles.phaseBanner} pointerEvents="none">
            <Text style={styles.phaseBannerText}>{dynamicPhaseText}</Text>
          </View>
        )}

        {/* Next Safe Zone Circle (Battle Royale PUBG / Free Fire Algorithm) */}
        {dynamicNextSafeCircle && (() => {
          const nextPx = getPixelCoord(
            dynamicNextSafeCircle.center.latitude,
            dynamicNextSafeCircle.center.longitude
          );
          const nextRPx = dynamicNextSafeCircle.radiusMeters / metersPerPixel;
          return (
            <React.Fragment key="next-safe-circle">
              <View
                pointerEvents="none"
                style={[
                  styles.nextSafeCircle,
                  {
                    left: nextPx.x - nextRPx,
                    top: nextPx.y - nextRPx,
                    width: nextRPx * 2,
                    height: nextRPx * 2,
                    borderRadius: nextRPx,
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.nextSafeTag,
                  {
                    left: nextPx.x - 45,
                    top: nextPx.y - nextRPx - 10,
                  },
                ]}
              >
                <Text style={styles.nextSafeTagText}>WHITE SAFE ZONE</Text>
              </View>
            </React.Fragment>
          );
        })()}

        {/* Play Zone Geofence Boundary Circle */}
        {zoneMode === 'CIRCLE' && (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.geofenceCircle,
                {
                  left: zoneCenterPx.x - zoneRadiusPx,
                  top: zoneCenterPx.y - zoneRadiusPx,
                  width: zoneRadiusPx * 2,
                  height: zoneRadiusPx * 2,
                  borderRadius: zoneRadiusPx,
                },
              ]}
            />

            {/* Zone Distance Tag */}
            <View
              pointerEvents="none"
              style={[
                styles.zoneTag,
                {
                  left: zoneCenterPx.x - 55,
                  top: zoneCenterPx.y - zoneRadiusPx - 10,
                },
              ]}
            >
              <Text style={styles.zoneTagText}>{zoneRadius}m PERIMETER</Text>
            </View>
          </>
        )}

        {/* Play Zone Polygon Boundary & Vertices */}
        {zoneMode === 'POLYGON' && polygonVertices.length > 0 && (
          <React.Fragment key="polygon-overlay">
            {/* SVG Polygon Fill & Closed Stroke */}
            {polygonVertices.length >= 3 && (
              <Svg
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              >
                <Polygon
                  points={polygonVertices
                    .map((v) => {
                      const p = getPixelCoord(v.latitude, v.longitude);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                  fill="rgba(34, 197, 94, 0.18)"
                  stroke="#DC5F52"
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                />
              </Svg>
            )}

            {/* Next Safe Polygon Warning Boundary (Dashed White Ghost) */}
            {dynamicNextSafePolygon && dynamicNextSafePolygon.length >= 3 && (
              <Svg
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              >
                <Polygon
                  points={dynamicNextSafePolygon
                    .map((v) => {
                      const p = getPixelCoord(v.latitude, v.longitude);
                      return `${p.x},${p.y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  strokeDasharray="6, 6"
                  strokeLinejoin="round"
                />
              </Svg>
            )}

            {/* Connecting Edge Line for 2 Vertices */}
            {polygonVertices.length === 2 && (() => {
              const p1 = getPixelCoord(polygonVertices[0].latitude, polygonVertices[0].longitude);
              const p2 = getPixelCoord(polygonVertices[1].latitude, polygonVertices[1].longitude);
              return (
                <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  <SvgLine
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#DC5F52"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                </Svg>
              );
            })()}

            {/* Vertex Markers matching Reference Screenshot (Vibrant Red Pin with White Border & White Text) */}
            {polygonVertices.map((vertex, idx) => {
              const px = getPixelCoord(vertex.latitude, vertex.longitude);
              return (
                <View
                  key={`vertex-${idx}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: px.x - 14,
                    top: px.y - 14,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: '#E65100',
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 25,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.35,
                    shadowRadius: 3,
                    elevation: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF' }}>
                    {idx + 1}
                  </Text>
                </View>
              );
            })}
          </React.Fragment>
        )}

        {/* Interactive Perimeter Boundary Control Handles (Distance Dots) */}
        {allowTapToSelectCenter && onChangeRadius && (
          <>
            {/* North Dot (+ 50m) */}
            <TouchableOpacity
              style={[
                styles.boundaryDot,
                {
                  left: zoneCenterPx.x - 14,
                  top: zoneCenterPx.y - zoneRadiusPx - 14,
                },
              ]}
              onPress={() => onChangeRadius(Math.max(100, zoneRadius + 50))}
              activeOpacity={0.7}
            >
              <View style={styles.boundaryDotInner}>
                <Text style={styles.boundaryDotText}>+</Text>
              </View>
            </TouchableOpacity>

            {/* South Dot (- 50m) */}
            <TouchableOpacity
              style={[
                styles.boundaryDot,
                {
                  left: zoneCenterPx.x - 14,
                  top: zoneCenterPx.y + zoneRadiusPx - 14,
                },
              ]}
              onPress={() => onChangeRadius(Math.max(100, zoneRadius - 50))}
              activeOpacity={0.7}
            >
              <View style={styles.boundaryDotInner}>
                <Text style={styles.boundaryDotText}>−</Text>
              </View>
            </TouchableOpacity>

            {/* East Dot (+ 100m) */}
            <TouchableOpacity
              style={[
                styles.boundaryDot,
                {
                  left: zoneCenterPx.x + zoneRadiusPx - 14,
                  top: zoneCenterPx.y - 14,
                },
              ]}
              onPress={() => onChangeRadius(Math.max(100, zoneRadius + 100))}
              activeOpacity={0.7}
            >
              <View style={styles.boundaryDotInner}>
                <Text style={styles.boundaryDotText}>+</Text>
              </View>
            </TouchableOpacity>

            {/* West Dot (- 100m) */}
            <TouchableOpacity
              style={[
                styles.boundaryDot,
                {
                  left: zoneCenterPx.x - zoneRadiusPx - 14,
                  top: zoneCenterPx.y - 14,
                },
              ]}
              onPress={() => onChangeRadius(Math.max(100, zoneRadius - 100))}
              activeOpacity={0.7}
            >
              <View style={styles.boundaryDotInner}>
                <Text style={styles.boundaryDotText}>−</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Custom Geofence Anchor Marker if user set custom anchor */}
        {customCenter && (
          <View
            pointerEvents="none"
            style={[
              styles.anchorMarkerContainer,
              {
                left: zoneCenterPx.x,
                top: zoneCenterPx.y,
              },
            ]}
          >
            <View style={styles.anchorOuterRing}>
              <View style={styles.anchorInnerDot} />
            </View>
            <View style={styles.anchorLabelPill}>
              <Text style={styles.anchorLabelText}>🎯 ZONE CENTER</Text>
            </View>
          </View>
        )}

        {/* Live GPS Accuracy Confidence Halo (Centered on self position) */}
        <View
          pointerEvents="none"
          style={[
            styles.accuracyHalo,
            {
              left: selfPx.x - accuracyRadiusPx,
              top: selfPx.y - accuracyRadiusPx,
              width: accuracyRadiusPx * 2,
              height: accuracyRadiusPx * 2,
              borderRadius: accuracyRadiusPx,
            },
          ]}
        />

        {/* Self Marker (Pulsing Diamond) */}
        <View
          pointerEvents="none"
          style={[
            styles.selfMarkerContainer,
            {
              left: selfPx.x - 30,
              top: selfPx.y - 14,
            },
          ]}
        >
          <View style={styles.selfDiamond} />
          <View style={styles.selfLabelPill}>
            <Text style={styles.selfLabelText}>YOU (GPS)</Text>
          </View>
        </View>

        {/* Other Multiplayer Player Markers */}
        {players.map((p) => {
          if (p.isSelf) return null;
          const pos = getPixelCoord(p.latitude, p.longitude);
          const isHunter = p.role === 'HUNTER';

          return (
            <View
              key={p.id}
              pointerEvents="none"
              style={[
                styles.playerMarkerContainer,
                { left: pos.x - 14, top: pos.y - 14 },
              ]}
            >
              <View
                style={[
                  styles.playerMarkerDot,
                  isHunter
                    ? styles.playerMarkerHunter
                    : styles.playerMarkerRunner,
                ]}
              />
              <View style={styles.playerLabelPill}>
                <Text style={styles.playerLabelText}>
                  {p.name.slice(0, 6)}
                  {p.distanceMeters !== undefined
                    ? ` (${Math.round(p.distanceMeters)}m)`
                    : ''}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Acquiring GPS Overlay if waiting for first fix */}
        {isAcquiring && (
          <View style={styles.stateOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.hunter.primary} />
            <Text style={styles.stateText}>ACQUIRING SATELLITE GPS LOCK...</Text>
            <Text style={styles.stateSubText}>Connecting to hardware GNSS receiver</Text>
          </View>
        )}

        {/* Permission Denied Overlay */}
        {permissionDenied && (
          <View style={styles.stateOverlay}>
            <Text style={styles.permIcon}>⚠️</Text>
            <Text style={styles.stateDangerText}>LOCATION ACCESS DENIED</Text>
            <Text style={styles.stateSubText}>
              GPS Manhunt requires continuous location permissions to track distance.
            </Text>
            {onRetryPermission && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={onRetryPermission}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>GRANT PERMISSION</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Top-Right Map Controls: Zoom & Recenter */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomIn}
            activeOpacity={0.7}
          >
            <PlusIcon size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomOut}
            activeOpacity={0.7}
          >
            <MinusIcon size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlBtn,
              (panOffset.x !== 0 || panOffset.y !== 0) && styles.recenterBtnActive,
            ]}
            onPress={handleRecenter}
            activeOpacity={0.7}
          >
            <TargetIcon size={16} color={panOffset.x !== 0 || panOffset.y !== 0 ? colors.runner.primary : '#FFFFFF'} />
          </TouchableOpacity>
        </View>

        {/* Zoom & Provider Attribution Badge */}
        <View style={styles.attributionBadge} pointerEvents="none">
          <Text style={styles.attributionText}>
            Z{zoom} • {mapboxToken ? 'Mapbox HD' : viewMode === 'satellite' ? 'Google Satellite Hybrid' : 'Google Maps'}
          </Text>
        </View>
      </View>

      {/* Live Precision Telemetry Card */}
      {!fullScreen && (
        <View style={styles.precisionBanner}>
          <View style={styles.precisionItem}>
            <Text style={styles.precisionLabel}>GPS ACCURACY</Text>
            <View style={styles.precisionValRow}>
              <View style={[styles.precisionDot, { backgroundColor: quality.color }]} />
              <Text style={[styles.precisionVal, { color: quality.color }]}>
                {accuracy ? `±${accuracy.toFixed(1)}m` : 'SEARCHING...'}
              </Text>
            </View>
          </View>
          <View style={styles.precisionDivider} />
          <View style={styles.precisionItem}>
            <Text style={styles.precisionLabel}>RECEIVER STATUS</Text>
            <Text style={[styles.statusTag, { color: quality.color }]}>
              {quality.text}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    alignItems: 'center',
    marginVertical: spacing.sm,
    width: '100%',
  },
  outerWrapperFullScreen: {
    ...StyleSheet.absoluteFillObject,
    marginVertical: 0,
    width: '100%',
    height: '100%',
  },
  mapContainerFullScreen: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: '#070A0F',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleBar: {
    flexDirection: 'row',
    width: MAP_CONTAINER_SIZE,
    backgroundColor: '#0F131A',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.xs,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  modeButtonActiveStreet: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
  },
  modeButtonActiveSat: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderColor: colors.runner.primary,
    borderWidth: 1,
  },
  modeButtonText: {
    color: colors.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  mapContainer: {
    backgroundColor: '#070A0F',
    borderRadius: borderRadius.lg,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  tilesLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  tileImage: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  crosshairH: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  geofenceCircle: {
    position: 'absolute',
    borderColor: colors.brand.gradientMid,
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(232, 93, 59, 0.15)',
    zIndex: 10,
  },
  zoneTag: {
    position: 'absolute',
    backgroundColor: 'rgba(10, 10, 10, 0.94)',
    borderColor: colors.brand.gradientMid,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    zIndex: 15,
  },
  zoneTagText: {
    color: colors.brand.gradientEnd,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tapInstructionBanner: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 16, 26, 0.92)',
    borderColor: colors.runner.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    zIndex: 26,
  },
  tapInstructionText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  anchorMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 140,
    marginLeft: -70,
    marginTop: -12,
    zIndex: 22,
  },
  anchorOuterRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.brand.gradientEnd,
    backgroundColor: 'rgba(232, 93, 59, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.gradientEnd,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  anchorInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  anchorLabelPill: {
    backgroundColor: 'rgba(10, 10, 10, 0.94)',
    borderColor: colors.brand.gradientEnd,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginTop: 4,
  },
  anchorLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  accuracyHalo: {
    position: 'absolute',
    borderColor: 'rgba(0, 229, 255, 0.65)',
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    zIndex: 12,
  },
  selfMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  selfDiamond: {
    width: 14,
    height: 14,
    backgroundColor: colors.hunter.primary,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: colors.hunter.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  selfLabelPill: {
    backgroundColor: 'rgba(10, 10, 10, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: 6,
  },
  selfLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  playerMarkerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 19,
    width: 28,
  },
  playerMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  playerMarkerHunter: {
    backgroundColor: colors.hunter.primary,
  },
  playerMarkerRunner: {
    backgroundColor: colors.runner.primary,
  },
  playerLabelPill: {
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 3,
  },
  playerLabelText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  stateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    padding: spacing.md,
    gap: 6,
  },
  stateText: {
    color: colors.hunter.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  stateDangerText: {
    color: colors.status.danger,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  stateSubText: {
    color: colors.text.muted,
    fontSize: 10,
    textAlign: 'center',
  },
  permIcon: {
    fontSize: 24,
  },
  retryBtn: {
    marginTop: 6,
    backgroundColor: colors.hunter.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  mapControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 25,
    gap: 6,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(18, 18, 18, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  recenterBtnActive: {
    borderColor: colors.runner.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  recenterIcon: {
    fontSize: 14,
  },
  attributionBadge: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 25,
  },
  attributionText: {
    color: colors.text.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  precisionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: MAP_CONTAINER_SIZE,
    backgroundColor: colors.background.surfaceCard,
    borderColor: colors.border.glass,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  precisionItem: {
    flex: 1,
  },
  precisionLabel: {
    color: colors.text.muted,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 2,
  },
  precisionValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  precisionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  precisionVal: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  precisionDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.glass,
    marginHorizontal: spacing.md,
  },
  phaseBanner: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 30, 30, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderColor: '#ffffff',
    borderWidth: 1,
    zIndex: 28,
  },
  phaseBannerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  nextSafeCircle: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 12,
  },
  nextSafeTag: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderColor: '#ffffff',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 13,
  },
  nextSafeTagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  boundaryDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.hunter.primary,
    borderColor: '#ffffff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 6,
  },
  boundaryDotInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boundaryDotText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
});
