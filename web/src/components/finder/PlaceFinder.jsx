import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import "./PlaceFinder.css";

export default function PlaceFinder({ onAddPlace }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.searchPlaces(query);
        setResults(res.places || []);
      } catch (err) {
        setError(err.message || "Không thể tìm kiếm địa điểm.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  return (
    <div className="place-finder space-y-3">
      <div className="relative">
        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm địa điểm thêm vào chuyến..."
          className="ui-field w-full pl-9 pr-4 text-xs"
        />
      </div>

      {loading && <p className="text-xs text-slate-400 italic">Đang tìm...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {results.map((p) => (
            <div
              key={p.id || p.slug}
              className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs"
            >
              <div className="truncate">
                <p className="font-bold text-slate-900 truncate">{p.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{p.address || p.category}</p>
              </div>
              <button
                onClick={() => onAddPlace(p)}
                className="btn-primary text-[11px] !py-1 !px-2.5 shrink-0"
              >
                + Thêm
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
