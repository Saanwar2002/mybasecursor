
"use client"; // Add this line

export function PublicFooter() {
  return (
    <footer className="py-8 px-6 border-t mt-auto bg-muted/50">
      <div className="container mx-auto text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} MyBase. All rights reserved.</p> {/* Updated App Name */}
        <p className="text-sm mt-1">ONE APP MANY CHOICES.</p> {/* Updated tagline from logo */}
      </div>
    </footer>
  );
}
