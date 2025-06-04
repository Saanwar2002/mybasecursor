
"use client";

import React, { useEffect } from 'react';

export function ThemeInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let themeToApply = localStorage.getItem('theme');

      if (!themeToApply) { // No theme explicitly set in localStorage
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          themeToApply = 'dark';
        } else {
          themeToApply = 'light';
        }
        // We don't set localStorage here, let the settings page do it if user interacts.
        // This component just ensures initial paint matches OS or stored preference.
      }

      if (themeToApply === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []); // Empty dependency array ensures this runs once on mount

  return <>{children}</>;
}
