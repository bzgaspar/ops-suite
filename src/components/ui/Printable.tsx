'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Content that is invisible on screen and is the only thing printed by window.print(). Mount one at a time. */
export default function Printable({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const div = document.createElement('div');
    div.className = 'print-root';
    document.body.appendChild(div);
    setEl(div);
    return () => { div.remove(); };
  }, []);
  return el ? createPortal(<div className="text-black bg-white text-[12px]">{children}</div>, el) : null;
}
