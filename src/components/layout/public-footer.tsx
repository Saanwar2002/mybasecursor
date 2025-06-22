"use client"; 

export function PublicFooter() {
  return (
    <footer className="py-8 bg-muted/50 border-t">
      <div className="container mx-auto text-center text-muted-foreground">
        <p className="text-sm">&copy; {new Date().getFullYear()} MyBase. All rights reserved.</p>
        <p className="text-xs mt-1">Your Journey, Simplified.</p>
      </div>
    </footer>
  );
}
