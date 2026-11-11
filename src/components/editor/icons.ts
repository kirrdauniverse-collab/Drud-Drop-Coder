"use client";

import {
  AudioLines, AudioWaveform, BadgeCheck, Bell, Bomb, Box, Car, ChevronsUp, Circle, CircleDot, Cloud,
  CloudLightning, CloudRain, CloudSnow, Coins, CopyPlus, Database, Dices, Disc3, Drum, Eraser, FileAudio,
  Flag, FlaskConical, FolderOpen, Gamepad2, Ghost, GitBranch, Guitar, Hand, Hash, Heart, HeartCrack, Home,
  Image, ImagePlus, Keyboard, Layers, ListChecks, MessageCircle, MousePointerClick, Music, Music4,
  Orbit, PartyPopper, Paintbrush, Repeat, Rocket, Save, Shapes, Siren, Snowflake, Sparkle, Sparkles,
  Star, TrendingDown, TreePine, Trophy, Type, Waves, Wind, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const BLOCK_ICONS: Record<string, LucideIcon> = {
  AudioLines, AudioWaveform, BadgeCheck, Bell, Bomb, Box, Car, ChevronsUp, Circle, CircleDot, Cloud,
  CloudLightning, CloudRain, CloudSnow, Coins, CopyPlus, Database, Dices, Disc3, Drum, Eraser, FileAudio,
  Flag, FlaskConical, FolderOpen, Gamepad2, Ghost, GitBranch, Guitar, Hand, Hash, Heart, HeartCrack, Home,
  Image, ImagePlus, Keyboard, Layers, ListChecks, MessageCircle, MousePointerClick, Music, Music4,
  Orbit, PartyPopper, Paintbrush, Repeat, Rocket, Save, Shapes, Siren, Snowflake, Sparkle, Sparkles,
  Star, TrendingDown, TreePine, Trophy, Type, Waves, Wind, Zap,
};

export function blockIcon(name: string): LucideIcon {
  return BLOCK_ICONS[name] ?? Box;
}
