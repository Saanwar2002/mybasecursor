export function PublicFooter() {
  return (
    <footer className="py-6 px-6 border-t mt-auto bg-card">
      <div className="container mx-auto text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TaxiNow. All rights reserved.</p>
        <p className="text-sm mt-1">Fast, Reliable, and Just a Tap Away.</p>
      </div>
    </footer>
  );
}
