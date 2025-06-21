"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Info,
  Power,
  Loader2,
  RefreshCw,
  BellRing,
  Settings
} from "lucide-react";
import Link from 'next/link';

export default function MobileDriverViewPage() {
  const [isOnline, setIsOnline] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [currentView, setCurrentView] = useState<'online' | 'assigned' | 'arrived' | 'inProgress' | 'completed'>('online');

  const views = {
    online: {
      title: "Online - Awaiting Offers",
      status: "Online",
      statusColor: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      icon: Power,
      action: "Simulate Offer"
    },
    assigned: {
      title: "En Route to Pickup",
      status: "Assigned",
      statusColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      icon: Navigation,
      action: "Notify Arrival"
    },
    arrived: {
      title: "Arrived at Pickup",
      status: "Arrived",
      statusColor: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      borderColor: "border-orange-200 dark:border-orange-800",
      icon: MapPin,
      action: "Start Ride"
    },
    inProgress: {
      title: "Ride in Progress",
      status: "In Progress",
      statusColor: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      borderColor: "border-purple-200 dark:border-purple-800",
      icon: Car,
      action: "Complete Ride"
    },
    completed: {
      title: "Ride Completed",
      status: "Completed",
      statusColor: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      icon: CheckCircle,
      action: "Done"
    }
  };

  const currentViewData = views[currentView];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">TaxiNow Driver</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Mobile View</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost">
              <Settings className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost">
              <BellRing className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className={`p-4 ${currentViewData.bgColor} border-b ${currentViewData.borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <currentViewData.icon className={`w-6 h-6 ${currentViewData.statusColor}`} />
            <div>
              <h2 className="font-bold text-lg">{currentViewData.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {currentViewData.status} • {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`font-bold ${currentViewData.statusColor} border-current`}>
            {currentViewData.status}
          </Badge>
        </div>
      </div>

      {/* Map Area */}
      <div className="h-64 bg-gradient-to-br from-blue-100 to-green-100 dark:from-blue-900/20 dark:to-green-900/20 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <Car className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-300">Interactive Map</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Real-time GPS tracking</p>
            </div>
          </div>
        </div>
        
        {/* Map Controls */}
        <div className="absolute top-4 right-4 space-y-2">
          <Button size="icon" variant="secondary" className="w-10 h-10 shadow-lg">
            <AlertTriangle className="w-5 h-5" />
          </Button>
          <Button size="icon" variant="secondary" className="w-10 h-10 shadow-lg">
            <TrafficCone className="w-5 h-5" />
          </Button>
        </div>

        {/* Location Info */}
        <div className="absolute bottom-4 left-4 right-4">
          <Card className="shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Huddersfield Station</span>
                </div>
                <Button size="icon" variant="outline" className="w-8 h-8">
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ride Details */}
      {currentView !== 'online' && (
        <div className="p-4 space-y-4">
          {/* Passenger Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <span className="font-bold text-blue-600 dark:text-blue-400">J</span>
                  </div>
                  <div>
                    <p className="font-bold">John Smith</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">+44 7700 900123</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="w-10 h-10">
                    <PhoneCall className="w-5 h-5" />
                  </Button>
                  <Button size="icon" variant="outline" className="w-10 h-10">
                    <MessageSquare className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ride Info */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">2 passengers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">~3.2 mi</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-bold text-green-600">£12.50</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-sm">ETA: 8 min</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Priority Badge */}
          {currentView === 'assigned' && (
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-orange-600" />
                    <span className="font-bold text-orange-700 dark:text-orange-300">Priority Booking</span>
                  </div>
                  <span className="font-bold text-orange-600">+£2.50</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wait & Return */}
          {currentView === 'inProgress' && (
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-purple-600" />
                    <span className="font-bold text-purple-700 dark:text-purple-300">Wait & Return</span>
                  </div>
                  <span className="font-bold text-purple-600">15 min</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Online Status */}
      {currentView === 'online' && (
        <div className="p-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center space-y-3">
                {isOnline ? (
                  <>
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                    <p className="font-bold text-lg">Searching for rides...</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Actively looking for ride offers in your area
                    </p>
                  </>
                ) : (
                  <>
                    <Power className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-bold text-lg">You're offline</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Go online to receive ride offers
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="online-toggle" className="font-bold">Online Status</Label>
                <Switch
                  id="online-toggle"
                  checked={isOnline}
                  onCheckedChange={setIsOnline}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pause-toggle" className="font-bold">Pause Offers</Label>
                <Switch
                  id="pause-toggle"
                  checked={isPaused}
                  onCheckedChange={setIsPaused}
                  disabled={!isOnline}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Button */}
      <div className="p-4">
        <Button 
          className={`w-full py-3 font-bold text-lg ${
            currentView === 'online' ? 'bg-blue-600 hover:bg-blue-700' :
            currentView === 'assigned' ? 'bg-green-600 hover:bg-green-700' :
            currentView === 'arrived' ? 'bg-orange-600 hover:bg-orange-700' :
            currentView === 'inProgress' ? 'bg-purple-600 hover:bg-purple-700' :
            'bg-slate-600 hover:bg-slate-700'
          }`}
        >
          {currentViewData.action}
        </Button>
      </div>

      {/* View Selector */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Object.entries(views).map(([key, view]) => (
            <Button
              key={key}
              variant={currentView === key ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentView(key as keyof typeof views)}
              className="whitespace-nowrap"
            >
              {view.status}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-around">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/driver/available-rides">
              <Car className="w-4 h-4 mr-2" />
              Full App
            </Link>
          </Button>
          <Button variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
} 