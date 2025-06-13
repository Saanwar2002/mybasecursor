
"use client";
import { useAuth, User, UserRole } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Edit3, Shield, Mail, Phone, Briefcase, Loader2, AlertTriangle, Users, Car as CarIcon, FileText, CalendarDays, Palette, CreditCard, UploadCloud } from "lucide-react"; // Added UploadCloud
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';
import Image from 'next/image'; // Added Next Image

// Helper to safely format date strings
const formatDateString = (dateString?: string): string => {
  if (!dateString) return "Not set";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return format(parseISO(dateString), "PPP");
    }
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
  const [isEditingBasicInfo, setIsEditingBasicInfo] = useState(false);
  const [isEditingVehicleInfo, setIsEditingVehicleInfo] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [vehicleMakeModel, setVehicleMakeModel] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState("");
  const [motExpiryDate, setMotExpiryDate] = useState("");
  const [taxiLicenseNumber, setTaxiLicenseNumber] = useState("");
  const [taxiLicenseExpiryDate, setTaxiLicenseExpiryDate] = useState("");

  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  

  const populateFormFields = useCallback(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phoneNumber || (user.role === 'driver' ? "555-0101" : ""));
      setProfilePicPreview(user.avatarUrl || null); // Initialize preview with current avatar

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

  useEffect(() => {
    populateFormFields();
  }, [user, populateFormFields]);

  // Clean up blob URL for preview
  useEffect(() => {
    return () => {
      if (profilePicPreview && profilePicPreview.startsWith('blob:')) {
        URL.revokeObjectURL(profilePicPreview);
      }
    };
  }, [profilePicPreview]);

  const handleSaveProfile = () => {
    if (!user) return;
    const updatedDetails: Partial<User> = {};
    let changesMade = false;

    if (isEditingBasicInfo) {
      if (name !== user.name) { updatedDetails.name = name; changesMade = true; }
      if (phone !== user.phoneNumber) { updatedDetails.phoneNumber = phone; changesMade = true; }
      if (profilePicFile) {
        // Simulate upload: generate a new placeholder URL
        updatedDetails.avatarUrl = `https://placehold.co/100x100/${Math.random().toString(16).substr(-6)}/FFFFFF.png?text=${name.charAt(0).toUpperCase() || 'U'}`;
        changesMade = true;
      }
    }

    if (user.role === 'driver' && isEditingVehicleInfo) {
      if (vehicleMakeModel !== user.vehicleMakeModel) { updatedDetails.vehicleMakeModel = vehicleMakeModel; changesMade = true; }
      if (vehicleRegistration !== user.vehicleRegistration) { updatedDetails.vehicleRegistration = vehicleRegistration; changesMade = true; }
      if (vehicleColor !== user.vehicleColor) { updatedDetails.vehicleColor = vehicleColor; changesMade = true; }
      if (insurancePolicyNumber !== user.insurancePolicyNumber) { updatedDetails.insurancePolicyNumber = insurancePolicyNumber; changesMade = true; }
      if (insuranceExpiryDate !== user.insuranceExpiryDate) { updatedDetails.insuranceExpiryDate = insuranceExpiryDate; changesMade = true; }
      if (motExpiryDate !== user.motExpiryDate) { updatedDetails.motExpiryDate = motExpiryDate; changesMade = true; }
      if (taxiLicenseNumber !== user.taxiLicenseNumber) { updatedDetails.taxiLicenseNumber = taxiLicenseNumber; changesMade = true; }
      if (taxiLicenseExpiryDate !== user.taxiLicenseExpiryDate) { updatedDetails.taxiLicenseExpiryDate = taxiLicenseExpiryDate; changesMade = true; }
    }

    if (changesMade && Object.keys(updatedDetails).length > 0) { 
        updateUserProfileInContext(updatedDetails); 
        toast({ title: "Profile Changes Applied", description: "Your profile display has been updated." });
        if (profilePicFile) { // If a new pic was "uploaded", reset file state
          setProfilePicFile(null);
          // Preview will update via useEffect when user.avatarUrl changes in context
        }
    } else {
        toast({ title: "No Changes Detected", description: "No information was modified.", variant: "default"});
    }
    
    if (isEditingBasicInfo && !isEditingVehicleInfo) setIsEditingBasicInfo(false);
    if (isEditingVehicleInfo && !isEditingBasicInfo) setIsEditingVehicleInfo(false);
    if (isEditingBasicInfo && isEditingVehicleInfo) { // If both were open, close basic, vehicle might still be intended for edit if separate save for it.
        setIsEditingBasicInfo(false);
        // Keep isEditingVehicleInfo true if you want separate save buttons, or set both to false if one save button.
        // For now, assuming one main "Save Basic Info" handles profile pic too.
    }
  };

  const handleCancelBasicInfoEdit = () => {
    setIsEditingBasicInfo(false);
    setProfilePicFile(null); // Clear any selected file
    if (user) {
        setName(user.name || "");
        setPhone(user.phoneNumber || "");
        setProfilePicPreview(user.avatarUrl || null); // Reset preview
    }
  };
  
  const handleCancelVehicleInfoEdit = () => {
    setIsEditingVehicleInfo(false);
    if (user && user.role === 'driver') {
        setVehicleMakeModel(user.vehicleMakeModel || "");
        setVehicleRegistration(user.vehicleRegistration || "");
        setVehicleColor(user.vehicleColor || "");
        setInsurancePolicyNumber(user.insurancePolicyNumber || "");
        setInsuranceExpiryDate(user.insuranceExpiryDate || "");
        setMotExpiryDate(user.motExpiryDate || "");
        setTaxiLicenseNumber(user.taxiLicenseNumber || "");
        setTaxiLicenseExpiryDate(user.taxiLicenseExpiryDate || "");
    }
  };


  if (!user) {
    return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-4 text-lg text-muted-foreground">Loading profile...</p> </div> );
  }

  const avatarSrc = (isEditingBasicInfo && profilePicPreview) 
    ? profilePicPreview 
    : (user?.avatarUrl || `https://placehold.co/100x100.png?text=${user.name.charAt(0).toUpperCase() || 'P'}`);


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader> <CardTitle className="text-3xl font-headline flex items-center gap-2"> <UserCircle className="w-8 h-8 text-primary" /> Your Profile </CardTitle> <CardDescription>View and manage your account details and preferences.</CardDescription> </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-4">
          <Avatar className="h-24 w-24 border-2 border-primary">
            <AvatarImage 
              src={avatarSrc} 
              alt={user.name || "User"} 
              data-ai-hint="avatar profile large"
            />
            <AvatarFallback className="text-3xl">{user.name ? user.name.charAt(0).toUpperCase() : "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left"> <CardTitle className="text-2xl font-headline">{user.name}</CardTitle> <CardDescription className="capitalize flex items-center justify-center md:justify-start gap-1"> <Briefcase className="w-4 h-4" /> {user.role} </CardDescription> </div>
          {!isEditingVehicleInfo && (
            <Button variant={isEditingBasicInfo ? "destructive" : "outline"} onClick={() => isEditingBasicInfo ? handleCancelBasicInfoEdit() : setIsEditingBasicInfo(true)}>
              <Edit3 className="mr-2 h-4 w-4" />
              {isEditingBasicInfo ? <span>Cancel Basic Info Edit</span> : <span>Edit Basic Info</span>}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label htmlFor="name">
              <span className="flex items-center gap-1"><UserCircle className="w-4 h-4 text-muted-foreground" /> Name</span>
            </Label>
            {isEditingBasicInfo ? (<Input id="name" value={name} onChange={(e) => setName(e.target.value)} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.name}</p>)}
          </div>
          {isEditingBasicInfo && (
            <div className="mt-2">
              <Label htmlFor="profilePicture">
                <span className="flex items-center gap-1"><UploadCloud className="w-4 h-4 text-muted-foreground" /> Profile Picture</span>
              </Label>
              <Input
                id="profilePicture"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setProfilePicFile(file);
                    if (profilePicPreview && profilePicPreview.startsWith('blob:')) {
                      URL.revokeObjectURL(profilePicPreview); // Clean up previous blob
                    }
                    setProfilePicPreview(URL.createObjectURL(file));
                  } else {
                    setProfilePicFile(null);
                    setProfilePicPreview(user.avatarUrl || null); // Revert to original if selection cancelled
                  }
                }}
                className="mt-1"
              />
              {profilePicPreview && profilePicPreview.startsWith('blob:') && ( // Only show file preview for blobs
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">New picture preview:</p>
                  <Image src={profilePicPreview} alt="Profile preview" width={80} height={80} className="rounded-full object-cover" />
                </div>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="email">
              <span className="flex items-center gap-1"><Mail className="w-4 h-4 text-muted-foreground" /> Email</span>
            </Label>
            <p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.email}</p>
            {isEditingBasicInfo && <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here. Contact support if needed.</p>}
          </div>
          <div>
            <Label htmlFor="phone">
              <span className="flex items-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" /> Phone Number</span>
            </Label>
            {isEditingBasicInfo ? (<Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={user.role === 'passenger' ? "Required for passengers" : "Optional"} />) : (<p className="text-lg font-medium p-2 rounded-md bg-muted/50">{user.phoneNumber || "Not set"}</p>)}
            {user.phoneVerified === false && user.phoneVerificationDeadline && (<p className="text-sm text-orange-600 mt-1">Phone not verified. Please verify by {new Date(user.phoneVerificationDeadline).toLocaleDateString()}. (Verification UI not yet implemented)</p>)}
            {user.phoneVerified === true && (<p className="text-sm text-green-600 mt-1">Phone verified.</p>)}
          </div>
           {isEditingBasicInfo && (
            <div className="flex justify-end">
                 <Button onClick={handleSaveProfile} className="bg-primary hover:bg-primary/90 text-primary-foreground">Save Basic Info</Button>
            </div>
            )}
          
          {user.role === 'driver' && (
            <>
              <Separator />
              <div className="flex flex-wrap justify-between items-center gap-2 pt-4">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                  <CarIcon className="w-6 h-6 text-primary" /> Vehicle &amp; Compliance
                </CardTitle>
                {!isEditingBasicInfo && (
                <Button variant={isEditingVehicleInfo ? "destructive" : "outline"} size="sm" onClick={() => isEditingVehicleInfo ? handleCancelVehicleInfoEdit() : setIsEditingVehicleInfo(true)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    {isEditingVehicleInfo ? <span>Cancel Vehicle Edit</span> : <span>Edit Vehicle Info</span>}
                </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <Label htmlFor="vehicleMakeModel"><span className="flex items-center gap-1"><CarIcon className="w-4 h-4 text-muted-foreground" /> Make &amp; Model</span></Label>
                  {isEditingVehicleInfo ? <Input id="vehicleMakeModel" value={vehicleMakeModel} onChange={(e) => setVehicleMakeModel(e.target.value)} placeholder="e.g., Toyota Prius" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.vehicleMakeModel || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="vehicleRegistration"><span className="flex items-center gap-1"><FileText className="w-4 h-4 text-muted-foreground" /> Registration</span></Label>
                  {isEditingVehicleInfo ? <Input id="vehicleRegistration" value={vehicleRegistration} onChange={(e) => setVehicleRegistration(e.target.value)} placeholder="e.g., AB12 CDE" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.vehicleRegistration || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="vehicleColor"><span className="flex items-center gap-1"><Palette className="w-4 h-4 text-muted-foreground" /> Color</span></Label>
                  {isEditingVehicleInfo ? <Input id="vehicleColor" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} placeholder="e.g., Silver" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.vehicleColor || "Not set"}</p>}
                </div>

                <Separator className="md:col-span-2 my-2" />

                <div>
                  <Label htmlFor="insurancePolicyNumber"><span className="flex items-center gap-1"><FileText className="w-4 h-4 text-muted-foreground" /> Insurance Policy No.</span></Label>
                  {isEditingVehicleInfo ? <Input id="insurancePolicyNumber" value={insurancePolicyNumber} onChange={(e) => setInsurancePolicyNumber(e.target.value)} placeholder="e.g., POLICY12345" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.insurancePolicyNumber || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="insuranceExpiryDate"><span className="flex items-center gap-1"><CalendarDays className="w-4 h-4 text-muted-foreground" /> Insurance Expiry</span></Label>
                  {isEditingVehicleInfo ? <Input id="insuranceExpiryDate" type="date" value={insuranceExpiryDate} onChange={(e) => setInsuranceExpiryDate(e.target.value)} /> : <p className="text-md p-2 rounded-md bg-muted/50">{formatDateString(user.insuranceExpiryDate)}</p>}
                </div>
                <div>
                  <Label htmlFor="motExpiryDate"><span className="flex items-center gap-1"><CalendarDays className="w-4 h-4 text-muted-foreground" /> MOT Expiry</span></Label>
                  {isEditingVehicleInfo ? <Input id="motExpiryDate" type="date" value={motExpiryDate} onChange={(e) => setMotExpiryDate(e.target.value)} /> : <p className="text-md p-2 rounded-md bg-muted/50">{formatDateString(user.motExpiryDate)}</p>}
                </div>
                <div>
                  <Label htmlFor="taxiLicenseNumber"><span className="flex items-center gap-1"><FileText className="w-4 h-4 text-muted-foreground" /> Taxi Plate/License No.</span></Label>
                  {isEditingVehicleInfo ? <Input id="taxiLicenseNumber" value={taxiLicenseNumber} onChange={(e) => setTaxiLicenseNumber(e.target.value)} placeholder="e.g., PLATE789" /> : <p className="text-md p-2 rounded-md bg-muted/50">{user.taxiLicenseNumber || "Not set"}</p>}
                </div>
                <div>
                  <Label htmlFor="taxiLicenseExpiryDate"><span className="flex items-center gap-1"><CalendarDays className="w-4 h-4 text-muted-foreground" /> Taxi License Expiry</span></Label>
                  {isEditingVehicleInfo ? <Input id="taxiLicenseExpiryDate" type="date" value={taxiLicenseExpiryDate} onChange={(e) => setTaxiLicenseExpiryDate(e.target.value)} /> : <p className="text-md p-2 rounded-md bg-muted/50">{formatDateString(user.taxiLicenseExpiryDate)}</p>}
                </div>
              </div>
              {isEditingVehicleInfo && (
                <div className="flex justify-end mt-4">
                    <Button onClick={handleSaveProfile} className="bg-primary hover:bg-primary/90 text-primary-foreground">Save Vehicle Info</Button>
                </div>
                )}
              <Alert variant="default" className="mt-4 bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
                <AlertTriangle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
                <AlertTitle className="font-semibold">Reminder</AlertTitle>
                <AlertDescription>
                  Keep these details up-to-date for compliance. Renewal notifications will be implemented soon.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6"> <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Shield className="w-5 h-5 text-green-500" /> Your information is kept secure. </div> </CardFooter>
      </Card>
      
      {user.role === 'passenger' && 
        <Card>
          <CardHeader><CardTitle className="text-xl flex items-center gap-2"><CreditCard className="w-5 h-5 text-muted-foreground"/>Payment Methods</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <CreditCard className="w-16 h-16 text-primary mb-4 opacity-50" />
            <p className="text-muted-foreground mb-3">
              Manage your saved payment methods for quick and easy booking.
            </p>
            <Button disabled className="bg-primary/80 hover:bg-primary/70">
              Add Payment Method (Coming Soon)
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Secure payment processing via Stripe (Test Mode) is planned.
            </p>
          </CardContent>
        </Card>
      }
    </div>
  );
}
