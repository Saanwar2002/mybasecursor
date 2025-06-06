
"use client";

export default function LandingPage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'hsl(var(--foreground))' }}>
        Marketing Landing Page
      </h1>
      <p style={{ marginTop: '1rem', color: 'hsl(var(--muted-foreground))' }}>
        If you see this, the basic page rendering is working.
      </p>
      <p style={{ marginTop: '0.5rem', color: 'hsl(var(--muted-foreground))' }}>
        The previous complex content has been temporarily removed for debugging.
      </p>
    </div>
  );
}
