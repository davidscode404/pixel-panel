'use client'

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full bg-stone-900/20 text-stone-400 py-6">
      <div className="max-w-4xl mx-auto text-center px-8">
        <div className="flex flex-wrap justify-center gap-6 text-sm mb-4">
          <Link href="/privacy-policy" className="hover:text-amber-400 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-amber-400 transition-colors">
            Terms of Service
          </Link>
        </div>
        <div className="text-xs text-stone-500">
          <p>&copy; 2025 PixelPanel AI Comics. Support: cfw.natalie@gmail.com</p>
        </div>
      </div>
    </footer>
  );
}
