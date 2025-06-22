
"use client";

import React from 'react'; // Ensure React is imported
import Link from 'next/link';
import Image from 'next/image'; // Added Image import

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="MyBase Home">
          <Image src="/mybase-logo.png" alt="MyBase Logo" width={120} height={30} priority />
        </Link>
        <nav className="flex items-center space-x-4 sm:space-x-6">
          <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Login
          </Link>
          <Button asChild size="sm">
            <Link href="/register">Sign Up</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

// Helper, assuming Button component exists as used in the original context
// If not, replace <Button> with a styled <Link> or <a>
const Button = ({ children, asChild, size, ...props }: any) => {
  if (asChild) {
    return React.cloneElement(children, props);
  }
  // Basic button styling, adapt as needed or import your actual Button
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      className={`bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium transition-colors ${sizeClasses}`}
      {...props}
    >
      {children.props.children /* Access children of Link */}
    </button>
  );
};
