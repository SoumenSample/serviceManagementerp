export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg bg-card"><p className="text-sm font-medium">{title}</p>{description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}</div>;
}
