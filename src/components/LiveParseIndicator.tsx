'use client';
import { useEffect, useState } from 'react';

export function LiveParseIndicator({ isTyping }: { isTyping: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isTyping) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  return (
    <div className="h-[2px] w-full bg-surface overflow-hidden relative rounded-b-md">
      {show && (
        <div 
          className="absolute inset-y-0 left-0 bg-accent transition-all ease-linear"
          style={{
            animation: 'liveParse 300ms linear forwards'
          }}
        />
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes liveParse {
          0% { width: 0%; opacity: 1; }
          80% { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
      `}} />
    </div>
  );
}