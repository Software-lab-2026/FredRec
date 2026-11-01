//Loading Animation
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export default function Loader({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <Spinner className="h-5 w-5 text-brand-600 dark:text-brand-400" />
    </div>
  );
}
