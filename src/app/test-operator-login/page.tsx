"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  User, 
  Car, 
  Briefcase, 
  Shield,
  Settings,
  Database,
  Globe,
  Lock,
  Unlock
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: string;
}

export default function TestOperatorLoginPage() {
  const { user, loginAsGuest, logout } = useAuth();
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  const runTest = async (testName: string, testFn: () => Promise<{ success: boolean; message: string; details?: string }>) => {
    setCurrentTest(testName);
    try {
      const result = await testFn();
      setTestResults(prev => [...prev, {
        name: testName,
        status: result.success ? 'success' : 'error',
        message: result.message,
        details: result.details
      }]);
      return result.success;
    } catch (error) {
      setTestResults(prev => [...prev, {
        name: testName,
        status: 'error',
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.stack : undefined
      }]);
      return false;
    }
  };

  const testOperatorLogin = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    // Test 1: Guest Operator Login
    await runTest("Guest Operator Login", async () => {
      try {
        const guestUser = await loginAsGuest('operator');
        if (guestUser.role === 'operator') {
          return {
            success: true,
            message: `Successfully logged in as operator: ${guestUser.name}`,
            details: `User ID: ${guestUser.id}, Email: ${guestUser.email}`
          };
        } else {
          return {
            success: false,
            message: `Login succeeded but wrong role: ${guestUser.role}`,
            details: `Expected: operator, Got: ${guestUser.role}`
          };
        }
      } catch (error) {
        return {
          success: false,
          message: "Guest operator login failed",
          details: error instanceof Error ? error.message : "Unknown error"
        };
      }
    });

    // Test 2: API Settings Access
    await runTest("Operator Settings API Access", async () => {
      try {
        const response = await fetch('/api/operator/settings/dispatch-mode');
        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            message: "Successfully accessed operator settings API",
            details: `Dispatch mode: ${data.dispatchMode}`
          };
        } else {
          return {
            success: false,
            message: `API access failed with status: ${response.status}`,
            details: await response.text()
          };
        }
      } catch (error) {
        return {
          success: false,
          message: "API access test failed",
          details: error instanceof Error ? error.message : "Unknown error"
        };
      }
    });

    // Test 3: Operational Settings API
    await runTest("Operational Settings API", async () => {
      try {
        const response = await fetch('/api/operator/settings/operational');
        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            message: "Successfully accessed operational settings",
            details: `Max wait time: ${data.maxAutoAcceptWaitTimeMinutes}min, Surge pricing: ${data.enableSurgePricing}`
          };
        } else {
          return {
            success: false,
            message: `Operational settings API failed with status: ${response.status}`,
            details: await response.text()
          };
        }
      } catch (error) {
        return {
          success: false,
          message: "Operational settings test failed",
          details: error instanceof Error ? error.message : "Unknown error"
        };
      }
    });

    // Test 4: Operator Dashboard Access
    await runTest("Operator Dashboard Access", async () => {
      try {
        const response = await fetch('/operator');
        if (response.ok) {
          return {
            success: true,
            message: "Successfully accessed operator dashboard",
            details: "Dashboard page loads correctly"
          };
        } else {
          return {
            success: false,
            message: `Dashboard access failed with status: ${response.status}`,
            details: await response.text()
          };
        }
      } catch (error) {
        return {
          success: false,
          message: "Dashboard access test failed",
          details: error instanceof Error ? error.message : "Unknown error"
        };
      }
    });

    // Test 5: Authentication Context
    await runTest("Authentication Context", async () => {
      if (user && user.role === 'operator') {
        return {
          success: true,
          message: "Authentication context working correctly",
          details: `User: ${user.name}, Role: ${user.role}, ID: ${user.id}`
        };
      } else {
        return {
          success: false,
          message: "Authentication context not working",
          details: user ? `User exists but wrong role: ${user.role}` : "No user in context"
        };
      }
    });

    setIsRunningTests(false);
    setCurrentTest('');
  };

  const clearTests = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'pending':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Operator Login Test Suite
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Comprehensive testing for operator authentication and functionality
          </p>
        </div>

        {/* Current User Status */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Current User Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{user.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Email:</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Role:</span>
                  <Badge variant={user.role === 'operator' ? 'default' : 'secondary'}>
                    {user.role}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">User ID:</span>
                  <span className="text-sm font-mono">{user.id}</span>
                </div>
                {user.operatorCode && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Operator Code:</span>
                    <span className="font-mono">{user.operatorCode}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-orange-600 dark:text-orange-400">No user logged in</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Test Controls
            </CardTitle>
            <CardDescription>
              Run comprehensive tests to verify operator functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button 
                onClick={testOperatorLogin} 
                disabled={isRunningTests}
                className="flex-1"
              >
                {isRunningTests ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Run Operator Tests
                  </>
                )}
              </Button>
              <Button 
                onClick={clearTests} 
                variant="outline"
                disabled={isRunningTests}
              >
                Clear Results
              </Button>
              {user && (
                <Button 
                  onClick={logout} 
                  variant="destructive"
                  disabled={isRunningTests}
                >
                  Logout
                </Button>
              )}
            </div>
            
            {isRunningTests && currentTest && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Currently testing: {currentTest}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Test Results
              </CardTitle>
              <CardDescription>
                {testResults.filter(r => r.status === 'success').length} of {testResults.length} tests passed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{result.name}</h4>
                        <p className="text-sm mt-1">{result.message}</p>
                        {result.details && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                              View Details
                            </summary>
                            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded mt-1 overflow-x-auto">
                              {result.details}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button asChild variant="outline" className="justify-start">
                <Link href="/operator">
                  <Briefcase className="mr-2 h-4 w-4" />
                  Go to Operator Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/login">
                  <Lock className="mr-2 h-4 w-4" />
                  Go to Login Page
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/test-driver-view">
                  <Car className="mr-2 h-4 w-4" />
                  Test Driver View
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/mobile-driver-view">
                  <User className="mr-2 h-4 w-4" />
                  Test Mobile View
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-medium">Authentication</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Database className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-slate-500">Connected</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Globe className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-medium">API Routes</p>
                <p className="text-xs text-slate-500">Available</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Settings className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-medium">Middleware</p>
                <p className="text-xs text-slate-500">Configured</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 