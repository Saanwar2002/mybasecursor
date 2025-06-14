
"use client";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from 'next/navigation'; // For potential redirect

export default function DriverDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("DriverDashboardPage: Render/Effect. User:", user?.email, "Role:", user?.role, "Loading:", loading);
    if (!loading && user && user.role !== 'driver') {
      console.warn(`DriverDashboardPage: Incorrect role ${user.role}. Should be handled by AuthContext or AppLayout.`);
      // Redirecting here might conflict with AuthContext, but as a safeguard:
      // router.push('/dashboard'); 
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '2px solid gray', backgroundColor: 'lightgray', minHeight: '100px' }}>
        <p style={{color: 'black', fontWeight: 'bold'}}>Driver Dashboard: Auth Loading...</p>
      </div>
    );
  }

  if (!user) {
    // This should ideally not be reached if AuthProvider is working correctly
    // and redirecting unauthenticated users from protected routes.
    return (
      <div style={{ padding: '20px', border: '2px solid orange', backgroundColor: 'lightyellow', minHeight: '100px' }}>
        <p style={{color: 'darkorange', fontWeight: 'bold'}}>Driver Dashboard: No user context. AuthProvider should handle redirect.</p>
      </div>
    );
  }
  
  // This check can also be a safeguard.
  if (user.role !== 'driver') {
     return (
        <div style={{ padding: '20px', border: '2px solid red', backgroundColor: 'pink', minHeight: '100px' }}>
          <p style={{color: 'darkred', fontWeight: 'bold'}}>Driver Dashboard: Incorrect role ({user.role}). This page is for drivers.</p>
        </div>
    );
  }

  // If we reach here, user is loaded and is a driver.
  return (
    <div style={{ padding: '20px', border: '3px solid darkgreen', backgroundColor: '#e6ffe6', minHeight: '200px' }}>
      <h1 style={{fontSize: '1.5rem', color: 'darkgreen', fontWeight: 'bold'}}>MINIMAL DRIVER DASHBOARD (GREEN BORDER - SUCCESS)</h1>
      <p>User: {user.name} ({user.email})</p>
      <p>Role: {user.role}</p>
      <p>Operator Code: {user.operatorCode || "N/A"}</p>
      <p>Driver Identifier: {user.driverIdentifier || "N/A"}</p>
      <p>This is the most basic driver dashboard content. If you see this, the page itself is rendering.</p>
    </div>
  );
}
