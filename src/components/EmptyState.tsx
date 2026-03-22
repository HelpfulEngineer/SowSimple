type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="surface-card px-5 py-6 text-sm text-slate-700 sm:px-6">
      <h3 className="font-display text-xl text-slate-900">{title}</h3>
      <p className="mt-2 max-w-2xl leading-6">{description}</p>
    </div>
  );
}
