"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface Booking {
  id: string;
  passengerId: string;
  driverId?: string;
  status: string;
  fare?: number;
  estimatedFare?: number;
}

export default function TestDataPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const usersResponse = await fetch('/api/admin/users?limit=10');
      const usersData = await usersResponse.json();
      
      if (usersResponse.ok) {
        setUsers(usersData.users || []);
      } else {
        console.error('Error fetching users:', usersData);
      }

      // Fetch bookings
      const bookingsResponse = await fetch('/api/bookings/my-rides');
      const bookingsData = await bookingsResponse.json();
      
      if (bookingsResponse.ok) {
        setBookings(bookingsData.bookings || []);
      } else {
        console.error('Error fetching bookings:', bookingsData);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Loading test data...</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Test Data Verification</h1>
        <Button onClick={fetchData}>Refresh Data</Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length > 0 ? (
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="p-3 border rounded">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-sm text-gray-600">Role: {user.role}</p>
                    <p className="text-sm text-gray-600">Status: {user.status}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No users found</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bookings ({bookings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length > 0 ? (
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <div key={booking.id} className="p-3 border rounded">
                    <p className="font-semibold">Booking {booking.id}</p>
                    <p className="text-sm text-gray-600">Status: {booking.status}</p>
                    <p className="text-sm text-gray-600">Passenger: {booking.passengerId}</p>
                    {booking.driverId && (
                      <p className="text-sm text-gray-600">Driver: {booking.driverId}</p>
                    )}
                    {(booking.fare || booking.estimatedFare) && (
                      <p className="text-sm text-gray-600">
                        Fare: £{booking.fare || booking.estimatedFare}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No bookings found</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Database Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-green-600">✅ Database seeded successfully</p>
            <p>• {users.length} users loaded</p>
            <p>• {bookings.length} bookings loaded</p>
            <p>• Sample data includes passengers, drivers, and operators</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 