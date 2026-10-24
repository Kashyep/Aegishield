interface PageBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function PageBody({ children, className = '' }: PageBodyProps) {
  return (
    <section className={`page-body ${className}`} aria-label="Page content">
      {children}
    </section>
  );
}