import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { GPSLocation } from '@/types/geo';
import { haversineDistance } from '@/lib/geo/distance';
import { initialBearing } from '@/lib/geo/bearing';
import { defaultGPSFilter } from '@/lib/geo/gpsFilter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIAL_SIZE = Math.min(SCREEN_WIDTH - 64, 320);
const CENTER = DIAL_SIZE / 2;
const RADIUS = DIAL_SIZE / 2 - 20;

export interface RadarHunter {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  tagEmoji?: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
}

interface LiveCompassRadarProps {
  currentLocation: GPSLocation | null;
  hunters: RadarHunter[];
  myInitials?: string;
  headingDegrees?: number;
  onSelectHunter?: (hunter: RadarHunter) => void;
}

export const LiveCompassRadar: React.FC<LiveCompassRadarProps> = ({
  currentLocation,
  hunters,
  myInitials = 'ME',
  headingDegrees = 0,
  onSelectHunter,
}) => {
  // Determine dynamic max range based on farthest hunter, min 200m
  const maxRange = Math.max(
    200,
    ...hunters.map((h) => {
      if (!currentLocation) return 200;
      return haversineDistance(currentLocation, {
        latitude: h.latitude,
        longitude: h.longitude,
      });
    })
  );

  // Compute hunter positions
  const hunterPositions = hunters.map((hunter) => {
    let dist = hunter.distanceMeters ?? 100;
    let bearing = 0;

    if (currentLocation) {
      const rawDist = haversineDistance(currentLocation, {
        latitude: hunter.latitude,
        longitude: hunter.longitude,
      });
      dist = defaultGPSFilter.smoothDistance(hunter.id, rawDist);
      bearing = initialBearing(currentLocation, {
        latitude: hunter.latitude,
        longitude: hunter.longitude,
      });
    }

    // North-Up Dial: 0° is North (top)
    const rad = ((bearing - 90) * Math.PI) / 180;

    // Scale distance to radius
    const scale = (RADIUS - 25) / maxRange;
    const r = Math.max(45, Math.min(dist * scale, RADIUS - 10));

    const x = CENTER + r * Math.cos(rad);
    const y = CENTER + r * Math.sin(rad);

    // Midpoint for distance badge
    const midX = (CENTER + x) / 2;
    const midY = (CENTER + y) / 2;

    return {
      hunter,
      dist: Math.round(dist),
      x,
      y,
      midX,
      midY,
      rad,
    };
  });

  return (
    <View style={styles.container}>
      {/* Top Heading readout matching screenshot_3_ui.webp */}
      <View style={styles.headingBadge}>
        <Text style={styles.headingText}>{Math.round(headingDegrees)}° N</Text>
        <View style={styles.northPointer}>
          <Text style={styles.northPointerText}>▲</Text>
        </View>
      </View>

      {/* Main Circular Dial */}
      <View style={[styles.dialContainer, { width: DIAL_SIZE, height: DIAL_SIZE }]}>
        {/* Cardinal Directions */}
        {/* North */}
        <View style={[styles.cardinalPoint, { top: 6, alignSelf: 'center' }]}>
          <Text style={styles.cardinalNorth}>N</Text>
        </View>
        {/* East */}
        <View style={[styles.cardinalPoint, { right: 8, top: CENTER - 10 }]}>
          <View style={styles.cardinalDot} />
          <Text style={styles.cardinalText}>E</Text>
        </View>
        {/* South */}
        <View style={[styles.cardinalPoint, { bottom: 6, alignSelf: 'center' }]}>
          <View style={styles.cardinalDot} />
          <Text style={styles.cardinalText}>S</Text>
        </View>
        {/* West */}
        <View style={[styles.cardinalPoint, { left: 8, top: CENTER - 10 }]}>
          <Text style={styles.cardinalText}>W</Text>
          <View style={styles.cardinalDot} />
        </View>

        {/* 45° Tick marks */}
        <View style={[styles.tickMark, { top: 22, left: 22, transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.tickMark, { top: 22, right: 22, transform: [{ rotate: '-45deg' }] }]} />
        <View style={[styles.tickMark, { bottom: 22, left: 22, transform: [{ rotate: '-45deg' }] }]} />
        <View style={[styles.tickMark, { bottom: 22, right: 22, transform: [{ rotate: '45deg' }] }]} />

        {/* SVG Vector Lines connecting center to hunters */}
        <Svg
          width={DIAL_SIZE}
          height={DIAL_SIZE}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        >
          {hunterPositions.map((pos) => (
            <Line
              key={`line-${pos.hunter.id}`}
              x1={CENTER}
              y1={CENTER}
              x2={pos.x}
              y2={pos.y}
              stroke="#1C1C1E"
              strokeWidth="2.5"
            />
          ))}
        </Svg>

        {/* Distance tags on lines */}
        {hunterPositions.map((pos) => (
          <View
            key={`dist-${pos.hunter.id}`}
            pointerEvents="none"
            style={[
              styles.distTag,
              {
                left: pos.midX - 18,
                top: pos.midY - 9,
              },
            ]}
          >
            <Text style={styles.distTagText}>{pos.dist}m</Text>
          </View>
        ))}

        {/* Center Node (Player) */}
        <View style={[styles.centerNode, { left: CENTER - 22, top: CENTER - 22 }]}>
          <View style={styles.centerNodeInner}>
            <Text style={styles.centerNodeText}>{myInitials}</Text>
          </View>
        </View>

        {/* Hunter Target Nodes & Tags */}
        {hunterPositions.map((pos) => (
          <TouchableOpacity
            key={`node-${pos.hunter.id}`}
            style={[
              styles.hunterNodeWrapper,
              {
                left: pos.x - 20,
                top: pos.y - 20,
              },
            ]}
            onPress={() => onSelectHunter?.(pos.hunter)}
            activeOpacity={0.8}
          >
            {/* Hunter Avatar Node */}
            <View
              style={[
                styles.hunterNodeCircle,
                { backgroundColor: pos.hunter.avatarColor || '#DE3B7E' },
              ]}
            >
              <Text style={styles.hunterNodeInitials}>{pos.hunter.initials}</Text>
            </View>

            {/* Attached Name Tag */}
            <View style={styles.hunterTagPill}>
              <Text style={styles.hunterTagText}>
                {pos.hunter.tagEmoji || '🎯'} {pos.hunter.name}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  headingBadge: {
    alignItems: 'center',
    marginBottom: 8,
  },
  headingText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  northPointer: {
    marginTop: 2,
  },
  northPointerText: {
    color: '#EF4444',
    fontSize: 16,
    lineHeight: 16,
  },
  dialContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: DIAL_SIZE / 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardinalPoint: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 5,
  },
  cardinalNorth: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  cardinalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardinalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1C1C1E',
  },
  tickMark: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: '#9CA3AF',
  },
  centerNode: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#F45B36',
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  centerNodeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerNodeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  distTag: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 15,
  },
  distTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  hunterNodeWrapper: {
    position: 'absolute',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  hunterNodeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  hunterNodeInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  hunterTagPill: {
    position: 'absolute',
    top: -18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 60,
    alignItems: 'center',
  },
  hunterTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1C1C1E',
  },
});
