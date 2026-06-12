/* Eventful - icon registry, backed by lucide-react.
   The EMS Figma style guide (and DESIGN.md section 9) mandates Lucide line
   icons: 24x24 viewBox, ~2px stroke, round caps/joins, currentColor. This
   wrapper keeps one <Icon name="..." /> API across the app while every glyph
   renders from the lucide-react library.
   "-solid" names render the same glyph filled (e.g. a saved heart). */

import type { CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  BellRing,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Eye,
  EyeOff,
  Globe,
  Heart,
  Info,
  LayoutDashboard,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Minus,
  Moon,
  Plus,
  QrCode,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-right-on-rectangle": LogOut,
  "arrow-trending-up": TrendingUp,
  "arrow-up-right": ArrowUpRight,
  "banknotes": Banknote,
  "bell": Bell,
  "bell-alert": BellRing,
  "calendar-days": CalendarDays,
  "calendar-plus": CalendarPlus,
  "chart-bar": LayoutDashboard,
  "check": Check,
  "check-badge": BadgeCheck,
  "check-circle": CheckCircle,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "clock": Clock,
  "envelope": Mail,
  "exclamation-triangle": AlertTriangle,
  "eye": Eye,
  "eye-slash": EyeOff,
  "globe": Globe,
  "heart": Heart,
  "information-circle": Info,
  "layout-dashboard": LayoutDashboard,
  "layout-grid": LayoutGrid,
  "list": List,
  "lock-closed": Lock,
  "magnifying-glass": Search,
  "map-pin": MapPin,
  "minus": Minus,
  "moon": Moon,
  "pencil-square": Edit,
  "plus": Plus,
  "qr-code": QrCode,
  "share": Share2,
  "shield-check": ShieldCheck,
  "sparkles": Sparkles,
  "sun": Sun,
  "ticket": Ticket,
  "trash": Trash2,
  "user": User,
  "users": Users,
  "x-mark": X,
};

interface IconProps {
  name: string;
  size?: number | string;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

export default function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  style,
  className,
  title,
}: IconProps) {
  const solid = name.endsWith("-solid");
  const baseName = solid ? name.slice(0, -6) : name;
  const Glyph = ICONS[baseName];
  if (!Glyph) return null;

  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      fill={solid ? "currentColor" : "none"}
      style={{ display: "block", flexShrink: 0, ...style }}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    />
  );
}
