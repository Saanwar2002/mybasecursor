// Global type declarations for TaxiNow application
import { Timestamp } from 'firebase/firestore';
import { RecaptchaVerifier } from 'firebase/auth';

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | null;
  }
}

// Firebase Timestamp type for compatibility
export interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

// Re-export Timestamp for easier imports
export { Timestamp };

// Common interfaces for the application
export interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'passenger' | 'driver' | 'operator' | 'admin';
  phone?: string;
  createdAt?: Timestamp | SerializedTimestamp;
  lastLogin?: Timestamp | SerializedTimestamp;
}

export interface ActiveRide {
  id: string;
  status: string;
  passengerId: string;
  driverId?: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  createdAt: Timestamp | SerializedTimestamp;
  updatedAt: Timestamp | SerializedTimestamp;
}

// Support ticket interface
export interface SupportTicket {
  id: string;
  category: string;
  details: string;
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Closed';
  submittedAt: Timestamp | SerializedTimestamp;
  lastUpdated?: Timestamp | SerializedTimestamp;
  canDelete: boolean;
}

// Ride interface for booking system
export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string;
  status: string;
  pickupLocation: LocationPoint | string;
  dropoffLocation: LocationPoint | string;
  stops?: LocationPoint[];
  bookingTimestamp: Timestamp | SerializedTimestamp;
  scheduledPickupAt?: Timestamp | SerializedTimestamp;
  rideStartedAt?: Timestamp | SerializedTimestamp;
  completedAt?: Timestamp | SerializedTimestamp;
  displayBookingId?: string;
  rating?: number;
  driver?: {
    name: string;
    phone?: string;
    vehicleInfo?: string;
  };
  vehicleType: string;
  fareEstimate: number;
  passengerName: string;
}

// Driver ride interface
export interface DriverRide {
  id: string;
  passengerId: string;
  passengerName: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  status: string;
  bookingTimestamp: Timestamp | SerializedTimestamp;
  rideStartedAt?: Timestamp | SerializedTimestamp;
  completedAt?: Timestamp | SerializedTimestamp;
  driverRatingForPassenger?: number | null;
}

// Notification interface
export interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp | SerializedTimestamp;
  read: boolean;
  link?: string;
  userId?: string;
  type?: string;
}

// Driver interface for nearby drivers
export interface Driver {
  id: string;
  name?: string;
  location: LocationPoint;
  status?: string;
  vehicleInfo?: string;
  phone?: string;
  isAvailable?: boolean;
  [key: string]: unknown; // For additional properties
}

// Booking interface for passenger bookings
export interface Booking {
  id: string;
  passengerId: string;
  driverId?: string;
  status: string;
  bookingTimestamp: Timestamp | SerializedTimestamp;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  passengerName?: string;
  driverName?: string;
  vehicleType?: string;
  fareEstimate?: number;
  [key: string]: unknown; // For additional properties
}

// Credit account interface
export interface CreditAccount {
  id: string;
  associatedUserId: string;
  balance: number;
  creditLimit: number;
  status?: string;
}

// Firebase error interface
export interface FirebaseError {
  code: string;
  message: string;
  name?: string;
}

// Generic API response interface
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export {};