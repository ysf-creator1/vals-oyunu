import { useEffect, useState } from 'react';

type Listener = (text: string) => void;
let listener: Listener | null = null;

/** Show a short, small info line that disappears on its own. */
export function toast(text: string) {
  listener?.(text);
}

export function Toaster() {
  const [item, setItem] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    listener = (text) => setItem({ text, key: Date.now() });
    return () => { listener = null; };
  }, []);
  useEffect(() => {
    if (!item) return;
    const id = setTimeout(() => setItem(null), 3000);
    return () => clearTimeout(id);
  }, [item]);
  if (!item) return null;
  return (
    <div className="toast" key={item.key} role="status" aria-live="polite" onClick={() => setItem(null)}>
      {item.text}
    </div>
  );
}
