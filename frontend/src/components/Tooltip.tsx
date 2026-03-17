import { useState, useRef, type ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
}

export default function Tooltip({ text, children, position = 'bottom' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = () => {
    clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 100);
  };

  const posClass = position === 'top'
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div className={`absolute ${posClass} left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 text-xs text-white bg-slate-800 rounded-lg shadow-lg whitespace-nowrap pointer-events-none`}>
          {text}
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 ${position === 'top' ? 'top-full -mt-1' : 'bottom-full mb-0 -mb-1'}`} />
        </div>
      )}
    </div>
  );
}
