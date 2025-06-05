
import type { UserRole } from '@/contexts/auth-context';
import { LayoutDashboard, Car, Sparkles, MessageCircle, History, UserCircle, Settings, DollarSign, Briefcase, BarChart3, Users, Star, MapPin, Contact, Send, Bot, Building, Shield } from 'lucide-react'; // Added Shield
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
  { href: '/operator/manage-passengers', label: 'Manage Passengers', icon: Contact, roles: ['operator'] },
  // "Manage Operators" is removed from here, moved to Admin
  { href: '/operator/analytics', label: 'Analytics', icon: BarChart3, roles: ['operator'] },
  { href: '/operator/communications', label: 'Communications', icon: Send, roles: ['operator'] },
  { href: '/operator/settings/pricing-settings', label: 'Pricing Settings', icon: DollarSign, roles: ['operator'] },

  // Admin
  { href: '/admin', label: 'Admin Dashboard', icon: Shield, roles: ['admin'] },
  { href: '/admin/manage-operators', label: 'Manage Operators', icon: Building, roles: ['admin'] },
  // Add other admin-specific pages here, e.g., platform-wide settings, user search, logs etc.
  // For now, Manage Operators is the primary admin function.
  // { href: '/admin/platform-settings', label: 'Platform Settings', icon: Settings, roles: ['admin'] },


  // Common
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['passenger', 'driver', 'operator', 'admin'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['passenger', 'driver', 'operator', 'admin'] },
];

export const getNavItemsForRole = (role: UserRole | undefined): NavItem[] => {
  if (!role) return [];
  return navItems.filter(item => item.roles.includes(role));
};
