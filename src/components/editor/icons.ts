"use client";

import {
  AudioLines, AudioWaveform, Bell, Bomb, Box, CircleDot, Cloud, Coins, Database, Dices,
  Drum, Eraser, FileAudio, FolderOpen, GitBranch, Hash, Heart, Image, ImagePlus, Keyboard,
  MousePointerClick, Music4, PartyPopper, Paintbrush, Repeat, Rocket, Save, Siren, Sparkles,
  Star, Type, Waves, Wind, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const BLOCK_ICONS: Record<string, LucideIcon> = {
  AudioLines, AudioWaveform, Bell, Bomb, Box, CircleDot, Cloud, Coins, Database, Dices,
  Drum, Eraser, FileAudio, FolderOpen, GitBranch, Hash, Heart, Image, ImagePlus, Keyboard,
  MousePointerClick, Music4, PartyPopper, Paintbrush, Repeat, Rocket, Save, Siren, Sparkles,
  Star, Type, Waves, Wind, Zap,
};

export function blockIcon(name: string): LucideIcon {
  return BLOCK_ICONS[name] ?? Box;
}
