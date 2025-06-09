"use client"; 

export function PublicFooter() {
  return (
    <footer style={{ border: '2px solid green', padding: '10px', margin: '10px', backgroundColor: 'lightgreen' }}>
      <h1 style={{ fontSize: '20px', color: 'green' }}>PUBLIC FOOTER HERE</h1>
      {/*
      <div className="container mx-auto text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} MyBase. All rights reserved.</p> 
        <p className="text-sm mt-1">ONE APP MANY CHOICES.</p> 
      </div>
      */}
    </footer>
  );
}
