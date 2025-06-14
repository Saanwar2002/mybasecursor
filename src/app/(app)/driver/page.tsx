
"use client";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from 'next/navigation';

export default function DriverDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("MINIMAL DriverDashboardPage: Effect. User:", user?.email, "Role:", user?.role, "Loading:", loading);
    if (!loading && user && user.role !== 'driver') {
      console.warn(`MINIMAL DriverDashboardPage: Incorrect role ${user.role}. Redirecting.`);
      router.push('/dashboard'); 
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ padding: '20px', border: '2px solid limegreen', backgroundColor: '#f0fff0', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{color: 'darkgreen', fontWeight: 'bold', fontSize: '1.2rem'}}>MINIMAL Driver Dashboard: Auth Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '20px', border: '2px solid darkorange', backgroundColor: '#fff8e1', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{color: 'darkorange', fontWeight: 'bold', fontSize: '1.2rem'}}>MINIMAL Driver Dashboard: No user context. Should be redirected.</p>
      </div>
    );
  }
  
  if (user.role !== 'driver') {
     return (
        <div style={{ padding: '20px', border: '2px solid darkred', backgroundColor: '#ffebee', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{color: 'darkred', fontWeight: 'bold', fontSize: '1.2rem'}}>MINIMAL Driver Dashboard: Incorrect role ({user.role}). This page is for drivers.</p>
        </div>
    );
  }

  return (
    <div style={{ padding: '40px', border: '5px solid green', backgroundColor: 'lightgreen', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{fontSize: '2rem', color: 'darkgreen', fontWeight: 'bold', marginBottom: '20px'}}>ULTRA MINIMAL DRIVER DASHBOARD (GREEN)</h1>
      <p style={{fontSize: '1.2rem', color: 'darkgreen'}}>User: {user.name} ({user.email})</p>
      <p style={{fontSize: '1.2rem', color: 'darkgreen'}}>Role: {user.role}</p>
      <p style={{fontSize: '1rem', color: 'darkgreen', marginTop: '10px' }}>If you see this, the driver page component itself is rendering!</p>
    </div>
  );
}
