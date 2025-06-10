
"use client";
import { useAuth, User, UserRole } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Edit3, Shield, Mail, Phone, Briefcase, Loader2, AlertTriangle, Users, Car as CarIcon, FileText, CalendarDays, Palette } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';

// Helper to safely format date strings
const formatDateString = (dateString?: string): string => {
  if (!dateString) return "Not set";
  try {
    // Check if it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return format(parseISO(dateString), "PPP"); // Format as "Oct 28th, 2023"
    }
    // Try to parse if it's another valid date string
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, "PPP");
    }
    return "Invalid Date";
  } catch (e) {
    return "Date Error";
  }
};


export default function ProfilePage() {
  const { user, login, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  // Basic profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Driver-specific vehicle & compliance fields
  const [vehicleMakeModel, setVehicleMakeModel] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState("");
  const [motExpiryDate, setMotExpiryDate] = useState("");
  const [taxiLicenseNumber, setTaxiLicenseNumber] = useState("");
  const [taxiLicenseExpiryDate, setTaxiLicenseExpiryDate] = useState("");
  

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phoneNumber || (user.role === 'driver' ? "555-0101" : ""));

      if (user.role === 'driver') {
        setVehicleMakeModel(user.vehicleMakeModel || "");
        setVehicleRegistration(user.vehicleRegistration || "");
        setVehicleColor(user.vehicleColor || "");
        setInsurancePolicyNumber(user.insurancePolicyNumber || "");
        setInsuranceExpiryDate(user.insuranceExpiryDate || "");
        setMotExpiryDate(user.motExpiryDate || "");
        setTaxiLicenseNumber(user.taxiLicenseNumber || "");
        setTaxiLicenseExpiryDate(user.taxiLicenseExpiryDate || "");
      }
    }
  }, [user]);

  const handleSaveProfile = () => {
    if (!user) return;
    const updatedDetails: Partial<User> = {};
    if (name !== user.name) updatedDetails.name = name;
    if (email !== user.email) updatedDetails.email = email; // Though not editable here
    if (phone !== user.phoneNumber) updatedDetails.phoneNumber = phone;

    if (user.role === 'driver') {
      if (vehicleMakeModel !== user.vehicleMakeModel) updatedDetails.vehicleMakeModel = vehicleMakeModel;
      if (vehicleRegistration !== user.vehicleRegistration) updatedDetails.vehicleRegistration = vehicleRegistration;
      if (vehicleColor !== user.vehicleColor) updatedDetails.vehicleColor = vehicleColor;
      if (insurancePolicyNumber !== user.insurancePolicyNumber) updatedDetails.insurancePolicyNumber = insurancePolicyNumber;
      if (insuranceExpiryDate !== user.insuranceExpiryDate) updatedDetails.insuranceExpiryDate = insuranceExpiryDate;
      if (motExpiryDate !== user.motExpiryDate) updatedDetails.motExpiryDate = motExpiryDate;
      if (taxiLicenseNumber !== user.taxiLicenseNumber) updatedDetails.taxiLicenseNumber = taxiLicenseNumber;
      if (taxiLicenseExpiryDate !== user.taxiLicenseExpiryDate) updatedDetails.taxiLicenseExpiryDate = taxiLicenseExpiryDate;
    }

    if (Object.keys(updatedDetails).length > 0) { updateUserProfileInContext(updatedDetails); }
    setIsEditing(false);
    toast({ title: "Profile Changes Applied (Mock)", description: "Your profile display has been updated." });
  };


  if (!user) {
    return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-4 text-lg text-muted-foreground">Loading profile...</p> </div> );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader> <CardTitle className="text-3xl font-headline flex items-center gap-2"> <UserCircle className="w-8 h-8 text-primary" /> Your Profile </CardTitle> <CardDescription>View and manage your account details and preferences.</CardDescription> </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-4">
          <Avatar className="h-24 w-24 border-2 border-primary"> <AvatarImage src={user?.avatarUrl || `https://placehold.co/100x100.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile large"/> <AvatarFallback className="text-3xl">{user.name.charAt(0).toUpperCase()}</AvatarFallback> </Avatar>
          <div className="flex-1 text-center md:text-left"> <CardTitle className="text-2xl font-headline">{user.name}</CardTitle> <CardDescription className="capitalize flex items-center justify-center md:justify-start gap-1"> <Briefcase className="w-4 h-4" /> {user.role} </CardDescription> </div>
          <Button variant={isEditing ? "destructive" : "outline"} onClick={() => setIsEditing(!isEditing)}>
            <span className="flex items-center justify-center">
              <Edit3 className="mr-2 h-4 w-4" />
              {isEditing ? <span>Cancel Edit</span> : <span>Edit Profile</span>}
            </span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label htmlFor="name">
              <span className="flex items-center gap-1"><UserCircle className="w-4 h-4 text-muted-foreground" /> Name</span>
            </Label>
            {isEditing ? (<Input id="name" value={name} onChange={(e) => setName(e.target.value)} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.name}</p>)}
          </div>
          <div>
            <Label htmlFor="email">
              <span className="flex items-center gap-1"><Mail className="w-4 h-4 text-muted-foreground" /> Email</span>
            </Label>
            <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.email}</p>
            {isEditing && <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here. Contact support if needed.</p>}
          </div>
          <div>
            <Label htmlFor="phone">
              <span className="flex items-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</span>
            </Label>
            {isEditing ? (<Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={user.role === 'passenger' ? "Required for passengers" : "Optional"} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.phoneNumber || "Not set"}</p>)}
            {user.phoneVerified === false && user.phoneVerificationDeadline && (<p className="text-sm text-orange-600 mt-1">Phone not verified. Please verify by {new Date(user.phoneVerificationDeadline).toLocaleDateString()}. (Verification UI not yet implemented)</p>)}
            {user.phoneVerified === true && (<p className="text-sm text-green-600 mt-1">Phone verified.</p>)}
          </div>
          
          {user.role === 'driver' && (
            <>
              <Separator />
              <CardTitle className="text-xl font-headline pt-4 flex items-center gap-2">
                <CarIcon className="w-6 h-6 text-primary" /> Vehicle & Compliance
              </CardTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <Label htmlFor="vehicleMakeModel"><span className="flex items-center gap-1"><CarIcon className="w-4 h-4 text-muted-foreground" /> Make & Model</span></Label>
                  {isEditing ? <Input id="vehicleMakeModel" value={vehicleMakeModel} onChange={(e) => setVehicleMakeModel(e.target.value)} placeholder="e.g., Toyota Prius" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.vehicleMakeModel || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="vehicleRegistration"><span className="flex items-center gap-1"><FileText className="w-4 h-4 text-muted-foreground" /> Registration</span></Label>
                  {isEditing ? <Input id="vehicleRegistration" value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} placeholder="e.g., AB12 CDE" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.vehicleRegistration || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="vehicleColor"><span className="flex items-center gap-1"><Palette className="w-4 h-4 text-muted-foreground" /> Color</span></Label>
                  {isEditing ? <Input id="vehicleColor" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} placeholder="e.g., Silver" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.vehicleColor || "Not set"}</p>}
                </div>

                <Separator className="md:col-span-2 my-2" />

                <div>
                  <Label htmlFor="insurancePolicyNumber"><span className="flex items-center gap-1"><FileText className="w-4 h-4 text-muted-foreground" /> Insurance Policy No.</span></Label>
                  {isEditing ? <Input id="insurancePolicyNumber" value={insurancePolicyNumber} onChange={(e) => setInsurancePolicyNumber(e.target.value)} placeholder="e.g., POLICY12345" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.insurancePolicyNumber || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="insuranceExpiryDate"><span className="flex items-center gap-1"><CalendarDays className="w-4 h-4 text-muted-foreground" /> Insurance Expiry</span></Label>
                  {isEditing ? <Input id="insuranceExpiryDate" type="date" value={insuranceExpiryDate} onChange={(e) => setInsuranceExpiryDate(e.target.value)} /> : <p className="text-md p-2 rounded-md bg-muted/50">{formatDateString(user.insuranceExpiryDate)}</p>}
                </div>
                <div>
                  <Label htmlFor="motExpiryDate"><span className="flex items-center gap-1"><CalendarDays className="w-4 h-4 text-muted-foreground" /> MOT Expiry</span></Label>
                  {isEditing ? <Input id="motExpiryDate" type="date" value={motExpiryDate} onChange={(e) => setMotExpiryDate(e.target.value)} /> : <p className="text-md p-2 rounded-md bg-muted/50">{formatDateString(user.motExpiryDate)}</p>}
                </div>
                <div>
                  <Label htmlFor="taxiLicenseNumber"><span className="flex items-center gap-1"><FileText className="w-4 h-4 text-muted-foreground" /> Taxi Plate/License No.</span></Label>
                  {isEditing ? <Input id="taxiLicenseNumber" value={taxiLicenseNumber} onChange={(e) => setTaxiLicenseNumber(e.target.value)} placeholder="e.g., PLATE789" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.taxiLicenseNumber || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="taxiLicenseExpiryDate"><span className="flex items-center gap-1"><CalendarDays className="w-4 h-4 text-muted-foreground" /> Taxi License Expiry</span></Label>
                  {isEditing ? <Input id="taxiLicenseExpiryDate" type="date" value={taxiLicenseExpiryDate} onChange={(e) => setTaxiLicenseExpiryDate(e.target.value)} /> : <p className="text-md p-2 rounded-md bg-muted/50">{formatDateString(user.taxiLicenseExpiryDate)}</p>}
                </div>
              </div>
              <Alert variant="default" className="mt-4 bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
                <AlertTriangle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
                <AlertTitle className="font-semibold">Reminder</AlertTitle>
                <AlertDescription>
                  Keep these details up-to-date for compliance. Renewal notifications will be implemented soon.
                </AlertDescription>
              </Alert>
            </>
          )}

          {isEditing && (<Button onClick={handleSaveProfile} className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground mt-6">Save Profile Changes</Button>)}
        </CardContent>
        <CardFooter className="border-t pt-6"> <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Shield className="w-5 h-5 text-green-500" /> Your information is kept secure. </div> </CardFooter>
      </Card>
      
      {user.role === 'passenger' && 
        <Card>
          <CardHeader><CardTitle className="text-xl flex items-center gap-2"><CreditCard className="w-5 h-5 text-muted-foreground"/>Payment Methods</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <CreditCard className="w-16 h-16 text-primary mb-4 opacity-50" />
            <p className="text-muted-foreground mb-3">
              Securely manage your payment methods here.
            </p>
            <Button disabled className="bg-primary/80 hover:bg-primary/70">
              Add Payment Method (Coming Soon)
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Integration with Stripe (Test Mode) is planned for future updates.
            </p>
          </CardContent>
        </Card>
      }
    </div>
  );
}
