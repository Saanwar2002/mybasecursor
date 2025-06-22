import { TaxiSuggester } from '@/components/ai/taxi-suggester';
import { CardDescription, CardHeader, CardTitle, Card } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

export default function AiSearchPage() {
  return (
    <div className="space-y-6">
       <Card className="shadow-md bg-gradient-to-r from-primary/10 to-accent/10">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Lightbulb className="w-8 h-8 text-primary" /> Smart Taxi Search
          </CardTitle>
          <CardDescription>
            Use our intelligent AI to find the perfect taxi based on your specific needs and preferences. 
            Just describe what you&apos;re looking for, and we&apos;ll handle the rest!
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="flex justify-center">
        <TaxiSuggester />
      </div>
    </div>
  );
}
