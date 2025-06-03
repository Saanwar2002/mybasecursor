
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, MapPin, ShieldCheck, MessagesSquare, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div style={{ padding: '20px', border: '2px solid red', backgroundColor: 'lightyellow' }}>
      <h1>Test: Landing Page Reached</h1>
      <p>If you see this, the basic rendering for this page works.</p>
      <p>The original landing page content has been temporarily replaced for debugging.</p>
    </div>
  );
}
