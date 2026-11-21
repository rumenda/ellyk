import {
  BarChart3, Bell, Bike, CalendarDays, ClipboardCheck, Code2, GraduationCap, Home, IdCard, Landmark,
  LayoutDashboard, MapPin, ScrollText, Settings, Sun, UserPlus, Users, Wallet,
} from "lucide-react";
import type { IconName } from "./nav-config";

export const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard, sun: Sun, users: Users, "user-plus": UserPlus, graduation: GraduationCap,
  calendar: CalendarDays, "id-card": IdCard, bike: Bike, wallet: Wallet, landmark: Landmark, clipboard: ClipboardCheck,
  "map-pin": MapPin, chart: BarChart3, settings: Settings, code: Code2, scroll: ScrollText, home: Home, bell: Bell,
};
