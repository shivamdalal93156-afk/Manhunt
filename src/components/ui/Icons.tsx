import React from 'react';
import Svg, { Circle, Path, Polyline, Line, Rect, Polygon } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export const ArrowBackIcon: React.FC<IconProps> = ({ size = 22, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="19" y1="12" x2="5" y2="12" />
    <Polyline points="12 19 5 12 12 5" />
  </Svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, color = '#4B5563' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);

export const HelpIcon: React.FC<IconProps> = ({ size = 22, color = '#4B5563' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <Line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={3} />
  </Svg>
);

export const AddUserIcon: React.FC<IconProps> = ({ size = 16, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <Circle cx="8.5" cy="7" r="4" />
    <Line x1="20" y1="8" x2="20" y2="14" />
    <Line x1="23" y1="11" x2="17" y2="11" />
  </Svg>
);

export const CompassIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
  </Svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Svg>
);

export const RadarIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 2a10 10 0 0110 10" />
    <Path d="M12 6a6 6 0 016 6" />
    <Circle cx="12" cy="12" r="2" />
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

export const LocateIcon: React.FC<IconProps> = ({ size = 20, color = '#DC5F52' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="7" />
    <Line x1="12" y1="1" x2="12" y2="5" />
    <Line x1="12" y1="19" x2="12" y2="23" />
    <Line x1="1" y1="12" x2="5" y2="12" />
    <Line x1="19" y1="12" x2="23" y2="12" />
    <Circle cx="12" cy="12" r="2" fill={color} />
  </Svg>
);

export const ListIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="8" y1="6" x2="21" y2="6" />
    <Line x1="8" y1="12" x2="21" y2="12" />
    <Line x1="8" y1="18" x2="21" y2="18" />
    <Line x1="3" y1="6" x2="3.01" y2="6" strokeWidth={3} />
    <Line x1="3" y1="12" x2="3.01" y2="12" strokeWidth={3} />
    <Line x1="3" y1="18" x2="3.01" y2="18" strokeWidth={3} />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const MinusIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const UndoIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="1 4 1 10 7 10" />
    <Path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 20, color = '#DC2626' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <Line x1="10" y1="11" x2="10" y2="17" />
    <Line x1="14" y1="11" x2="14" y2="17" />
  </Svg>
);

export const TargetIcon: React.FC<IconProps> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Circle cx="12" cy="12" r="6" />
    <Circle cx="12" cy="12" r="2" fill={color} />
  </Svg>
);

export const ShapesIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" />
  </Svg>
);

export const PowerIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18.36 6.64a9 9 0 11-12.73 0" />
    <Line x1="12" y1="2" x2="12" y2="12" />
  </Svg>
);

export const TimerIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="13" r="8" />
    <Polyline points="12 9 12 13 15 15" />
    <Line x1="12" y1="2" x2="12" y2="5" />
    <Line x1="9" y1="2" x2="15" y2="2" />
  </Svg>
);

export const FlashIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Svg>
);

export const HeartIcon: React.FC<IconProps> = ({ size = 20, color = '#EF4444' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </Svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 16, color = '#6B7280' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color = '#10B981' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const SprintIcon: React.FC<IconProps> = ({ size = 20, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="13.5" cy="4.5" r="2.5" />
    <Path d="M14 8.5l-3 4-4-2-2 3" />
    <Path d="M11 12.5l2 3.5 4-1.5 2 4.5" />
  </Svg>
);

export const ManhuntLogo: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    {/* Dark rounded shield background */}
    <Rect width="100" height="100" rx="22" fill="#0A0E17" />
    <Rect x="2" y="2" width="96" height="96" rx="20" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
    {/* Radar rings */}
    <Circle cx="50" cy="50" r="38" stroke="#00E5FF" strokeWidth="2" strokeOpacity="0.4" />
    <Circle cx="50" cy="50" r="26" stroke="#00E5FF" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="3 3" />
    <Circle cx="50" cy="50" r="14" stroke="#FF5722" strokeWidth="2" />
    {/* Tactical Reticle crosshairs */}
    <Line x1="50" y1="6" x2="50" y2="24" stroke="#FF5722" strokeWidth="3" strokeLinecap="round" />
    <Line x1="50" y1="76" x2="50" y2="94" stroke="#FF5722" strokeWidth="3" strokeLinecap="round" />
    <Line x1="6" y1="50" x2="24" y2="50" stroke="#00E5FF" strokeWidth="3" strokeLinecap="round" />
    <Line x1="76" y1="50" x2="94" y2="50" stroke="#00E5FF" strokeWidth="3" strokeLinecap="round" />
    {/* Center target dot */}
    <Circle cx="50" cy="50" r="4" fill="#FF5722" />
  </Svg>
);


