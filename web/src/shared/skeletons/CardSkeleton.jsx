export default function CardSkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="ui-card p-4 animate-pulse space-y-3 border border-slate-200/60"
        >
          <div className="bg-slate-200 h-40 rounded-2xl w-full" />
          <div className="bg-slate-200 h-5 rounded-lg w-3/4" />
          <div className="bg-slate-200 h-4 rounded-lg w-1/2" />
        </div>
      ))}
    </>
  );
}
