
export function PublicFooter() {
  return (
    <footer className="py-8 px-6 border-t mt-auto bg-muted/50">
      <div className="container mx-auto text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Link Cabs. All rights reserved.</p>
        <p className="text-sm mt-1">Fast, Reliable, and Just a Tap Away.</p>
      </div>
    </footer>
  );
}
