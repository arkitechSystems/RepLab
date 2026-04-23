import { useState, useEffect, useRef } from 'react';

export default function StickyHeader({ title, subtitle, children, bottomContent, titleClassName = '', titleStyle, titleCentered = false }) {
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
        <div className={titleCentered
          ? 'relative flex items-center justify-center gap-3'
          : 'flex items-center justify-between gap-3'
        }>
          {title ? <div className={`min-w-0${titleCentered ? ' text-center' : ''}`}>
            <h1
              className={`font-black text-white tracking-tight transition-all duration-300 ${
                collapsed ? 'text-lg' : 'text-3xl'
              } ${titleClassName}`}
              style={titleStyle}
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
          </div> : null}
          {children && (titleCentered ? (
            <div className="absolute right-0 top-1/2 -translate-y-1/2">{children}</div>
          ) : children)}
        </div>
        {typeof bottomContent === 'function' ? bottomContent(collapsed) : bottomContent}
      </div>
    </>
  );
}
