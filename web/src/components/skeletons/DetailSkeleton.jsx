export default function DetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-6">
      <div className="bg-slate-200 h-64 rounded-3xl w-full" />
      <div className="space-y-3">
        <div className="bg-slate-200 h-8 rounded-xl w-1/2" />
        <div className="bg-slate-200 h-4 rounded-lg w-1/4" />
      </div>
      <div className="bg-slate-200 h-32 rounded-2xl w-full" />
    </div>
  );
}
