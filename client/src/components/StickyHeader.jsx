import { useState, useEffect, useRef } from 'react';

export default function StickyHeader({ title, subtitle, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setCollapsed(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />
      <div
        className={`sticky-header px-4 ${
          collapsed ? 'collapsed py-3' : 'pt-6 pb-4'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1
              className={`font-black text-white tracking-tight transition-all duration-300 ${
                collapsed ? 'text-lg' : 'text-3xl'
              }`}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className={`text-wf-gray-400 mt-0.5 transition-all duration-300 truncate ${
                  collapsed ? 'text-xs' : 'text-sm'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
