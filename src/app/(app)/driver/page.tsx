"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'; 
import { Car, DollarSign, History, MessageCircle, Navigation, Bell, Users, ListChecks, CheckCircle, Loader2 } from 'lucide-react'; // Added Loader2
import { useAuth } from '@/contexts/auth-context';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from 'react'; // Added useEffect
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { DriverAccountHealthCard } from '@/components/driver/DriverAccountHealthCard'; 
import { useRouter } from 'next/navigation'; 
import { collection, query, where, onSnapshot, Timestamp, doc, setDoc, updateDoc, serverTimestamp, GeoPoint, deleteField, getDocs } from 'firebase/firestore';
import { db as importedDb } from '@/lib/firebase';

if (!importedDb) {
  throw new Error('Firestore db is not initialized. Check your Firebase config.');
}
const db = importedDb;

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false); 
  const router = useRouter(); 

  const activeRide = null; 
  // const earningsToday = 75.50; // Remove static value

  const [earningsTodayDisplay, setEarningsTodayDisplay] = useState<string | null>(null);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(true);

  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [isLoadingAccountBalance, setIsLoadingAccountBalance] = useState(true);

  useEffect(() => {
    if (!user || !db) return;
    setIsLoadingAccountBalance(true);
    const cacheKey = `accountBalance_${user.id}`;
    const cacheTimestampKey = `accountBalanceTimestamp_${user.id}`;
    const cachedBalance = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cacheTimestampKey);
    const now = Date.now();
    if (cachedBalance && cachedTimestamp && now - parseInt(cachedTimestamp, 10) < 3600000) {
      setAccountBalance(Number(cachedBalance));
      setIsLoadingAccountBalance(false);
      return;
    }
    // Fetch from backend (Firestore)
    const accountsRef = collection(db, 'creditAccounts');
    const q = query(accountsRef, where('driverId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let balance = 0;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        balance += data.balance || 0;
      });
      setAccountBalance(balance);
      setIsLoadingAccountBalance(false);
      localStorage.setItem(cacheKey, String(balance));
      localStorage.setItem(cacheTimestampKey, String(Date.now()));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;
    setIsLoadingEarnings(true);
    const earningsRef = collection(db, 'earnings');
    // Get today's date in YYYY-MM-DD
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    // Query for today's earnings for this driver
    const q = query(earningsRef, where('driverId', '==', user.id), where('date', '==', todayStr));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        total += data.netEarning || 0;
      });
      setEarningsTodayDisplay(`£${total.toFixed(2)}`);
      setIsLoadingEarnings(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync isOnline state with Firestore in real time
  useEffect(() => {
    if (!user || !db) return;
    const driverRef = doc(db, 'drivers', user.id);
    const unsubscribe = onSnapshot(driverRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('[onSnapshot] Firestore driver doc:', data);
        setIsOnline(data.status === 'Active' && data.availability === 'online');
      } else {
        console.log('[onSnapshot] Firestore driver doc does not exist for UID:', user.id);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleOnlineStatusChange = async (checked: boolean) => {
    console.log('[handleOnlineStatusChange] Toggle changed:', checked);
    setIsOnline(checked);
    if (!user || !db) {
      console.log('[handleOnlineStatusChange] User or db missing');
      return;
    }
    console.log('[handleOnlineStatusChange] Current UID:', user.id, 'Current Email:', user.email);

    if (checked) {
      // Get driver's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              if (!db) throw new Error('Firestore db is not initialized');
              // Store location as an object with lat/lng fields
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              console.log('[handleOnlineStatusChange] Attempting to set driver online with location:', location);
              // Update the driver's document in the 'drivers' collection using ID
              await setDoc(
                doc(db, 'drivers', user.id),
                {
                  uid: user.id, // Store UID in the document for migration safety
                  name: user.name,
                  email: user.email,
                  status: 'Active',
                  availability: 'online',
                  location,
                  createdAt: serverTimestamp(),
                  vehicleCategory: user.vehicleCategory || '',
                  operatorCode: user.operatorCode || '',
                  // ...add any other fields you want to store
                },
                { merge: true }
              );
              console.log('[handleOnlineStatusChange] Driver location written to Firestore:', location);
              // Also update status in the users collection
              await updateDoc(doc(db, 'users', user.id), { status: 'Active' });
              console.log('[handleOnlineStatusChange] Driver status set to Active in both collections.');
            } catch (err) {
              console.error('[handleOnlineStatusChange] Error setting driver online:', err);
              alert('Failed to set driver online. See console for details.');
              setIsOnline(false);
            }
          },
          (error) => {
            console.error('[handleOnlineStatusChange] Geolocation error:', error);
            alert('Location access denied. You must allow location to go online.');
            setIsOnline(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
      router.push('/driver/available-rides');
    } else {
      try {
        if (!db) throw new Error('Firestore db is not initialized');
        console.log('[handleOnlineStatusChange] Going offline - trying email-based lookup for:', user.email);
        // Find driver document by email instead of UID
        const driversRef = collection(db, 'drivers');
        const q = query(driversRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          console.error('[handleOnlineStatusChange] No driver document found with email:', user.email);
          alert('Driver document not found. Please contact support.');
          setIsOnline(true);
          return;
        }
        const driverDoc = querySnapshot.docs[0];
        console.log('[handleOnlineStatusChange] Found driver document with ID:', driverDoc.id, 'for email:', user.email);
        // Update the found document
        await updateDoc(driverDoc.ref, { 
          status: 'Inactive', 
          availability: 'offline', 
          location: deleteField() 
        });
        console.log('[handleOnlineStatusChange] Driver document updated to offline in Firestore using email lookup');
        // Also update status in the users collection (still using UID)
        await updateDoc(doc(db, 'users', user.id), { status: 'Inactive' });
        console.log('[handleOnlineStatusChange] User document updated to offline in Firestore');
      } catch (err) {
        console.error('[handleOnlineStatusChange] Error setting driver offline:', err);
        alert('Failed to set driver offline. See console for details.');
        setIsOnline(true);
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Dashboard Content Column */}
      <div className="lg:w-2/3 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-3xl font-headline">Welcome, {user?.name || 'Driver'}!</CardTitle>
                          <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="online-status"
                  checked={isOnline}
                  onChange={e => handleOnlineStatusChange(e.target.checked)}
                  className="h-5 w-5 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <Label htmlFor="online-status" className={isOnline ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {isOnline ? "Online" : "Offline"}
                </Label>
              </div>
            </div>
            </div>
            <CardDescription>Manage your rides, track earnings, and stay connected.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-6">
            <div className="w-full space-y-4">
              <p className="text-lg">You are currently <span className={isOnline ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{isOnline ? "Online and available" : "Offline"}</span> for new ride offers.</p>
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/driver/available-rides">
                  <Car className="mr-2 h-5 w-5" /> Check for Ride Offers
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <DriverAccountHealthCard />

        <div className="grid gap-6 md:grid-cols-2">
          {activeRide && (
            <Card className="md:col-span-2 lg:col-span-1 bg-primary/10 border-primary/30">
              <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" /> Current Ride
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>Passenger:</strong> {(activeRide as any).passenger}</p>
                <p><strong>Pickup:</strong> {(activeRide as any).pickup}</p>
                <p><strong>Dropoff:</strong> {(activeRide as any).dropoff}</p>
                <Button variant="outline" className="w-full mt-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground">Navigate to Pickup</Button>
              </CardContent>
            </Card>
          )}
          <Card className={activeRide ? "" : "md:col-span-1"}>
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" /> Earnings Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingEarnings ? (
                <div className="flex items-center justify-center h-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <p className="text-3xl font-bold">{earningsTodayDisplay || "£0.00"}</p>
              )}
              <Link href="/driver/earnings" className="text-base font-semibold text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">View Detailed Earnings</Link>
            </CardContent>
          </Card>
          {/* Latest Account Jobs Balance Card */}
          <Card className={activeRide ? "" : "md:col-span-1"}>
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-500" /> Latest Account Jobs Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAccountBalance ? (
                <div className="flex items-center justify-center h-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : accountBalance !== null ? (
                <p className="text-3xl font-bold">£{accountBalance.toFixed(2)}</p>
              ) : (
                <p className="text-muted-foreground">No account job data</p>
              )}
              <Link href="/driver/ride-history?filter=account" className="text-base font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-500 transition-colors">View Account Jobs</Link>
            </CardContent>
          </Card>
        </div>

        {/* Feature cards removed as per user request */}
      </div>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  actionText: string;
}

function FeatureCard({ title, description, icon: Icon, link, actionText }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center pb-4">
        <Icon className="w-10 h-10 text-accent mb-3" />
        <CardTitle className="font-headline text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" asChild>
          <Link href={link}>{actionText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
