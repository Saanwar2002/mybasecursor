
import type { UserRole } from '@/contexts/auth-context';
import { LayoutDashboard, Car, Sparkles, MessageCircle, History, UserCircle, Settings, DollarSign, Briefcase, BarChart3, Users, Star, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  subItems?: NavItem[];
}

export const navItems: NavItem[] = [
  // Passenger
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['passenger'] },
  { href: '/dashboard/book-ride', label: 'Book a Ride', icon: Car, roles: ['passenger'] },
  { href: '/dashboard/ai-search', label: 'AI Taxi Search', icon: Sparkles, roles: ['passenger'] },
  { href: '/dashboard/my-rides', label: 'My Rides', icon: History, roles: ['passenger'] },
  { href: '/dashboard/track-ride', label: 'Track Ride', icon: MapPin, roles: ['passenger'] },
  { href: '/dashboard/favorites', label: 'Favorites', icon: Star, roles: ['passenger'] },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageCircle, roles: ['passenger'] },
  
  // Driver
  { href: '/driver', label: 'Driver Dashboard', icon: LayoutDashboard, roles: ['driver'] },
  { href: '/driver/available-rides', label: 'Available Rides', icon: Car, roles: ['driver'] },
  { href: '/driver/earnings', label: 'Earnings', icon: DollarSign, roles: ['driver'] },
  { href: '/driver/ride-history', label: 'Ride History', icon: History, roles: ['driver'] },
  { href: '/driver/chat', label: 'Chat', icon: MessageCircle, roles: ['driver'] },

  // Operator
  { href: '/operator', label: 'Operator Panel', icon: Briefcase, roles: ['operator'] },
  { href: '/operator/manage-rides', label: 'Manage Rides', icon: Car, roles: ['operator'] },
  { href: '/operator/manage-drivers', label: 'Manage Drivers', icon: Users, roles: ['operator'] },
  { href: '/operator/analytics', label: 'Analytics', icon: BarChart3, roles: ['operator'] },

  // Common
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['passenger', 'driver', 'operator'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['passenger', 'driver', 'operator'] },
];

export const getNavItemsForRole = (role: UserRole | undefined): NavItem[] => {
  if (!role) return [];
  return navItems.filter(item => item.roles.includes(role));
};

    