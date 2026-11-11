"use client";

import {
  AlarmClock, AudioLines, AudioWaveform, BadgeCheck, Bell, BellRing, Bird, Bomb, Bot, Box, Building2,
  Cake, Candy, Car, Cat, ChevronsUp, Circle, CircleDot, Cloud, CloudLightning, CloudRain,
  CloudSnow, CloudSun, Coins, CopyPlus, Crown, Database, Diamond, Dices, Disc, Disc3, Dog, Donut,
  Droplets, Drum, Egg, Eraser, FileAudio, Fish, Flame, Flag, FlaskConical, Flower, FolderOpen, Gamepad2,
  Gauge, Gem, Ghost, Gift, GitBranch, Guitar, Hand, Hash, Heart, HeartCrack, Home, Image, ImagePlus,
  Keyboard, KeyRound, Layers, Leaf, LayoutGrid, ListChecks, MessageCircle, Megaphone, Moon, MoonStar,
  MousePointerClick, Mountain, MountainSnow, Music, Music2, Music4, Orbit, Package, Paintbrush, PartyPopper,
  Phone, Rabbit, Rainbow, Repeat, Rocket, Save, Shapes, Shell, Shield, Siren, Snail, Sparkle, Sparkles,
  Sprout, Star, Sun, Sunset, Sword, TreePine, Trophy, Triangle, Turtle, Type, Umbrella, Waves, Wind,
  Wand2, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const BLOCK_ICONS: Record<string, LucideIcon> = {
  AlarmClock, AudioLines, AudioWaveform, BadgeCheck, Bell, BellRing, Bird, Bomb, Bot, Box, Building2,
  Cake, Candy, Car, Cat, ChevronsUp, Circle, CircleDot, Cloud, CloudLightning, CloudRain,
  CloudSnow, CloudSun, Coins, CopyPlus, Crown, Database, Diamond, Dices, Disc, Disc3, Dog, Donut,
  Droplets, Drum, Egg, Eraser, FileAudio, Fish, Flame, Flag, FlaskConical, Flower, FolderOpen, Gamepad2,
  Gauge, Gem, Ghost, Gift, GitBranch, Guitar, Hand, Hash, Heart, HeartCrack, Home, Image, ImagePlus,
  Keyboard, KeyRound, Layers, Leaf, LayoutGrid, ListChecks, MessageCircle, Megaphone, Moon, MoonStar,
  MousePointerClick, Mountain, MountainSnow, Music, Music2, Music4, Orbit, Package, Paintbrush, PartyPopper,
  Phone, Rabbit, Rainbow, Repeat, Rocket, Save, Shapes, Shell, Shield, Siren, Snail, Sparkle, Sparkles,
  Sprout, Star, Sun, Sunset, Sword, TreePine, Trophy, Triangle, Turtle, Type, Umbrella, Waves, Wind,
  Wand2, Zap,
};

export function blockIcon(name: string): LucideIcon {
  return BLOCK_ICONS[name] ?? Box;
}
