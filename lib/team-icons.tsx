import {
  Briefcase,
  Building2,
  Code,
  Compass,
  Flag,
  Globe,
  Heart,
  Layers,
  Lightbulb,
  Megaphone,
  Palette,
  Puzzle,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { TEAM_ICON_OPTIONS } from "@/lib/constants";

// Icon-key -> component + friendly label. Kept out of lib/constants.ts since
// that file is plain data with no JSX/component imports.
export const TEAM_ICON_META: Record<string, { icon: LucideIcon; label: string }> = {
  Users: { icon: Users, label: "Users" },
  Rocket: { icon: Rocket, label: "Rocket" },
  Briefcase: { icon: Briefcase, label: "Briefcase" },
  Target: { icon: Target, label: "Target" },
  Star: { icon: Star, label: "Star" },
  Flag: { icon: Flag, label: "Flag" },
  Layers: { icon: Layers, label: "Layers" },
  Zap: { icon: Zap, label: "Zap" },
  Globe: { icon: Globe, label: "Globe" },
  Shield: { icon: Shield, label: "Shield" },
  Palette: { icon: Palette, label: "Palette" },
  Code: { icon: Code, label: "Code" },
  Megaphone: { icon: Megaphone, label: "Megaphone" },
  Compass: { icon: Compass, label: "Compass" },
  Lightbulb: { icon: Lightbulb, label: "Lightbulb" },
  Puzzle: { icon: Puzzle, label: "Puzzle" },
  Heart: { icon: Heart, label: "Heart" },
  Trophy: { icon: Trophy, label: "Trophy" },
  Building2: { icon: Building2, label: "Building" },
  Sparkles: { icon: Sparkles, label: "Sparkles" },
};

export const DEFAULT_TEAM_ICON = TEAM_ICON_OPTIONS[0];

export function TeamIcon({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  const Icon = (icon && TEAM_ICON_META[icon]?.icon) || TEAM_ICON_META[DEFAULT_TEAM_ICON].icon;
  return <Icon className={className} />;
}
