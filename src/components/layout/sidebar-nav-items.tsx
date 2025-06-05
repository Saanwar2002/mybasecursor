
import type { UserRole } from '@/contexts/auth-context';
import { LayoutDashboard, Car, Sparkles, MessageCircle, History, UserCircle, Settings, DollarSign, Briefcase, BarChart3, Users, Star, MapPin, Contact, Send, Bot, Building, Shield, UserCog, UserCheck, UserX, UserSearch, BrainCircuit, Activity } from 'lucide-react'; // Added BrainCircuit, Activity
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
  { href: '/dashboard/track-ride', label: 'My Active Ride', icon: MapPin, roles: ['passenger'] },
  { href: '/dashboard/my-rides', label: 'Rides History', icon: History, roles: ['passenger'] },
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
  { href: '/operator/analytics', label: 'Analytics', icon: BarChart3, roles: ['operator'] },
  { href: '/operator/communications', label: 'Communications', icon: Send, roles: ['operator'] },
  { href: '/operator/settings/pricing-settings', label: 'Pricing Settings', icon: DollarSign, roles: ['operator'] },

  // Admin
  { href: '/admin', label: 'Admin Dashboard', icon: Shield, roles: ['admin'] },
  { href: '/admin/manage-operators', label: 'Manage Operators', icon: Building, roles: ['admin'] },
  { 
    href: '/admin/platform-users', 
    label: 'Platform Users', 
    icon: Users, 
    roles: ['admin'],
    subItems: [
      { href: '/admin/platform-users', label: 'All Users', icon: Users, roles: ['admin']},
      { href: '/admin/platform-users?role=passenger', label: 'Passengers', icon: UserSearch, roles: ['admin']},
      { href: '/admin/platform-users?role=driver', label: 'Drivers', icon: Car, roles: ['admin']},
      { href: '/admin/platform-users?role=operator', label: 'Operators', icon: Briefcase, roles: ['admin']},
      { href: '/admin/platform-users?role=admin', label: 'Administrators', icon: UserCog, roles: ['admin']},
    ]
  },
  { href: '/admin/analytics', label: 'System Analytics', icon: BarChart3, roles: ['admin'] },
  { href: '/admin/global-settings', label: 'Global Settings', icon: Settings, roles: ['admin'] },
  { href: '/admin/ai-system-health', label: 'AI System Health', icon: BrainCircuit, roles: ['admin'] },


  // Common
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['passenger', 'driver', 'operator', 'admin'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['passenger', 'driver', 'operator', 'admin'] },
];

// Function to get navigation items based on role, handling sub-items
export const getNavItemsForRole = (role: UserRole | undefined): NavItem[] => {
  if (!role) return [];
  
  const filteredNavItems: NavItem[] = [];

  navItems.forEach(item => {
    if (item.roles.includes(role)) {
      // If the item has sub-items, filter them as well if needed (though for now, sub-items inherit role)
      // For simplicity, if the parent is included, all its sub-items are included.
      // You could add role checks to sub-items too if necessary.
      filteredNavItems.push({ ...item });
    }
  });
  return filteredNavItems;
};
