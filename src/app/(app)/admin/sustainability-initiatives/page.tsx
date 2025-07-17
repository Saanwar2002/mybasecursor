
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, TrendingUp, Zap, Recycle, Lightbulb, Info, Edit, CheckCircle, CircleEllipsis, PlusCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const mockInitiatives = [
  { id: "ev_research", name: "Research EV Fleet Discount Programs", status: "Researching", progress: 30, category: "EV Adoption" },
  { id: "carbon_offset", name: "Evaluate Carbon Offset Partners", status: "Planned", progress: 10, category: "Carbon Offset" },
  { id: "eco_driving", name: "Promote Eco-Driving Tips to Drivers", status: "Implemented", progress: 100, category: "Operational Efficiency" },
  { id: "green_office", name: "Reduce Office Paper Consumption", status: "In Progress", progress: 75, category: "Eco-Friendly Operations" },
];

export default function SustainabilityInitiativesPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Leaf className="w-8 h-8 text-primary" /> Sustainability Initiatives & Planning
          </CardTitle>
          <CardDescription>
            Outline, track, and manage the platform's environmental sustainability efforts and green initiatives.
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">Conceptual Planning Page</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          This page is for outlining strategies and tracking potential sustainability initiatives. Actual implementation requires further development and potentially third-party integrations.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" /> Electric Vehicle (EV) Adoption
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Strategies for increasing EV usage within the fleet.</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Offer incentives for drivers switching to EVs.</li>
              <li>Partner with local charging station providers.</li>
              <li>Promote EV ride options to passengers.</li>
              <li>Track percentage of EV rides on the platform.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <Recycle className="w-5 h-5 text-accent" /> Carbon Offset Programs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Plans for offsetting the carbon footprint of rides.</p>
             <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Research and integrate with reputable carbon offset providers.</li>
              <li>Offer passengers an option to contribute to offsetting their ride.</li>
              <li>Report on total carbon offset achieved.</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" /> Route & Operational Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Minimizing environmental impact through smarter operations.</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Analyze ride data to suggest more fuel-efficient routes.</li>
              <li>Provide eco-driving training/tips for drivers.</li>
              <li>Minimize deadhead mileage through intelligent dispatch.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent" /> Eco-Friendly Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Broader initiatives for environmental responsibility.</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Promote paperless operations (digital receipts, statements).</li>
              <li>Partner with eco-conscious local businesses.</li>
              <li>Community green initiatives sponsorship.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Current Initiatives & Progress (Mock Data)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Initiative</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Progress</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInitiatives.map((initiative) => (
                <TableRow key={initiative.id}>
                  <TableCell className="font-medium">{initiative.name}</TableCell>
                  <TableCell>{initiative.category}</TableCell>
                  <TableCell>
                    <Badge variant={
                        initiative.status === "Implemented" ? "default" :
                        initiative.status === "In Progress" ? "secondary" :
                        "outline"
                    } className={
                        initiative.status === "Implemented" ? "bg-green-100 text-green-700 border-green-300" :
                        initiative.status === "In Progress" ? "bg-blue-100 text-blue-700 border-blue-300" : ""
                    }>
                        {initiative.status === "Implemented" && <CheckCircle className="mr-1 h-3 w-3" />}
                        {initiative.status === "In Progress" && <CircleEllipsis className="mr-1 h-3 w-3 animate-pulse" />}
                        {initiative.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Progress value={initiative.progress} className="h-2" indicatorClassName={
                        initiative.progress === 100 ? "bg-green-500" : 
                        initiative.progress > 50 ? "bg-blue-500" : "bg-yellow-500"
                    } />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                      <Edit className="mr-1 h-3 w-3" /> Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
         <CardFooter>
            <Button disabled>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Initiative (Placeholder)
            </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline">Impact Tracking (Placeholder)</CardTitle>
        </CardHeader>
        <CardContent>
             <p className="text-muted-foreground">
                This section will display key metrics related to sustainability efforts, such as:
            </p>
            <ul className="list-disc list-inside pl-5 mt-2 text-muted-foreground text-sm space-y-1">
                <li>Estimated CO2 emissions reduced (platform-wide).</li>
                <li>Percentage of rides completed by EVs.</li>
                <li>Number of drivers participating in EV incentive programs.</li>
                <li>Funds raised/contributed to carbon offset programs.</li>
            </ul>
        </CardContent>
      </Card>

    </div>
  );
}
