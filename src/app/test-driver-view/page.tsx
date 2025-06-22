"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Car, 
  MapPin, 
  Clock, 
  Users, 
  DollarSign, 
  PhoneCall, 
  MessageSquare, 
  Navigation,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  Route,
  Crown,
  Timer,
  ShieldCheck,
  TrafficCone,
  Gauge,
  Info
} from "lucide-react";
import Link from 'next/link';

export default function TestDriverViewPage() {
  const [selectedScenario, setSelectedScenario] = useState<string>('online');

  const scenarios = {
    online: {
      title: "Driver Online - Awaiting Offers",
      description: "Driver is online and waiting for ride offers",
      status: "Online",
      statusColor: "text-green-600",
      borderColor: "border-green-500",
      features: [
        "Location tracking active",
        "Polling for new ride offers",
        "Speed limit monitoring available",
        "Hazard reporting enabled"
      ]
    },
    assigned: {
      title: "Ride Assigned - En Route to Pickup",
      description: "Driver has accepted a ride and is heading to pickup",
      status: "En Route to Pickup",
      statusColor: "text-blue-600",
      borderColor: "border-blue-500",
      features: [
        "Real-time navigation to pickup",
        "Passenger details visible",
        "Fare estimate displayed",
        "ETA calculation active"
      ]
    },
    arrived: {
      title: "Arrived at Pickup - Waiting for Passenger",
      description: "Driver has arrived and is waiting for passenger acknowledgment",
      status: "Arrived at Pickup",
      statusColor: "text-orange-600",
      borderColor: "border-orange-500",
      features: [
        "Waiting timer active",
        "Free waiting period (3 mins)",
        "Extra waiting charges apply",
        "No-show reporting available"
      ]
    },
    inProgress: {
      title: "Ride in Progress - Multiple Stops",
      description: "Ride is active with multiple stops and wait & return",
      status: "In Progress",
      statusColor: "text-purple-600",
      borderColor: "border-purple-500",
      features: [
        "Multi-stop navigation",
        "Stop timers and charges",
        "Wait & return functionality",
        "Real-time fare calculation"
      ]
    },
    completed: {
      title: "Ride Completed - Summary",
      description: "Ride has been completed with final fare and rating",
      status: "Completed",
      statusColor: "text-green-600",
      borderColor: "border-green-500",
      features: [
        "Final fare breakdown",
        "Passenger rating system",
        "Job completion summary",
        "Return to available rides"
      ]
    }
  };

  const currentScenario = scenarios[selectedScenario as keyof typeof scenarios];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            TaxiNow Driver App - Test View
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Interactive browser view for testing driver app scenarios
          </p>
        </div>

        {/* Scenario Selector */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Test Scenarios
            </CardTitle>
            <CardDescription>
              Select a scenario to view the driver app in different states
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedScenario} onValueChange={setSelectedScenario} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="online">Online</TabsTrigger>
                <TabsTrigger value="assigned">Assigned</TabsTrigger>
                <TabsTrigger value="arrived">Arrived</TabsTrigger>
                <TabsTrigger value="inProgress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - App Preview */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg h-[600px] relative overflow-hidden">
              <CardHeader className={`border-b-4 ${currentScenario.borderColor} bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700`}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={`text-lg font-bold ${currentScenario.statusColor}`}>
                      {currentScenario.title}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {currentScenario.description}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={`font-bold ${currentScenario.statusColor} border-current`}>
                    {currentScenario.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 h-full">
                {/* Map Area */}
                <div className="h-2/3 bg-gradient-to-br from-blue-100 to-green-100 dark:from-blue-900/20 dark:to-green-900/20 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                        <Car className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Interactive Map View
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Google Maps integration with real-time tracking
                      </p>
                    </div>
                  </div>
                  
                  {/* Map Controls */}
                  <div className="absolute top-4 right-4 space-y-2">
                    <Button size="icon" variant="secondary" className="w-8 h-8">
                      <AlertTriangle className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="w-8 h-8">
                      <TrafficCone className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Navigation Bar */}
                <div className="h-1/3 bg-white dark:bg-slate-800 border-t">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">Huddersfield Train Station</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">St George's Square, HD1 1JB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="w-8 h-8">
                          <Info className="w-4 h-4" />
                        </Button>
                        <Button size="icon" className="w-8 h-8 bg-blue-600 hover:bg-blue-700">
                          <Navigation className="w-4 h-4 text-white" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium">2 passengers</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-bold text-green-600">£12.50</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Route className="w-4 h-4 text-slate-500" />
                          <span className="text-sm">~3.2 mi</span>
                        </div>
                      </div>
                      <Button className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2">
                        Notify Arrival
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Features & Controls */}
          <div className="space-y-6">
            {/* Current Features */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Active Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentScenario.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/driver/available-rides">
                    <Car className="w-4 h-4 mr-2" />
                    Open Driver App
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Call Passenger
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Timer className="w-4 h-4 mr-2" />
                  Start Timer
                </Button>
              </CardContent>
            </Card>

            {/* Status Indicators */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Status Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Location Tracking</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Network Connection</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">GPS Signal</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Strong
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Battery Level</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    65%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Priority Features */}
            {selectedScenario === 'assigned' && (
              <Card className="shadow-lg border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Crown className="w-5 h-5" />
                    Priority Booking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Priority Fee</span>
                      <span className="font-bold text-orange-600">+£2.50</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Fare</span>
                      <span className="font-bold text-lg">£15.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Wait & Return */}
            {selectedScenario === 'inProgress' && (
              <Card className="shadow-lg border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Timer className="w-5 h-5" />
                    Wait & Return
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Wait Time</span>
                      <span className="font-bold">15 mins</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Additional Charge</span>
                      <span className="font-bold text-purple-600">+£3.75</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Fare</span>
                      <span className="font-bold text-lg">£16.25</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This is a test view for the TaxiNow Driver App. Use this to understand the different states and features.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>Built with Next.js 14</span>
                <span>•</span>
                <span>TypeScript</span>
                <span>•</span>
                <span>Tailwind CSS</span>
                <span>•</span>
                <span>Shadcn/ui</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 