import {
  ArrowLeftRight, Bell, Calendar, Check, ChevronLeft, ChevronRight, CircleAlert, Clock, Coffee, Download, FileText,
  House, LogOut, MapPin, Menu, MessageSquare, Monitor, Pencil, Play, Plus, Search, Send, Settings, ShieldCheck,
  Smartphone, SquareCheck, Trash2, Users, X, Eye, EyeOff, User,
} from 'lucide-react';

const icons = {
  home: House, calendar: Calendar, clock: Clock, monitor: Monitor, chat: MessageSquare, people: Users,
  settings: Settings, phone: Smartphone, logout: LogOut, search: Search, chevron: ChevronLeft, chevronNext: ChevronRight,
  menu: Menu, plus: Plus, download: Download, swap: ArrowLeftRight, pin: MapPin, file: FileText, check: Check,
  alert: CircleAlert, coffee: Coffee, play: Play, send: Send, bell: Bell, edit: Pencil, trash: Trash2, close: X,
  shield: ShieldCheck, eye: Eye, eyeOff: EyeOff, user: User, task: SquareCheck,
} as const;

export type IconName = keyof typeof icons;

/** Lucide, 24px grid, 1.75 stroke, currentColor (brand book → Iconography). */
export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const C = icons[name];
  return <C size={size} strokeWidth={1.75} aria-hidden="true" className={className} />;
}
