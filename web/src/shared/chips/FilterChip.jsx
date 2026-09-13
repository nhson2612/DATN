import React from "react";

export default function FilterChip({ label, icon, isActive = true, onClick, onRemove, zIndex }) {
  return (
    <div
      style={{ zIndex }}
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer border-2 border-white whitespace-nowrap shadow-sm hover:z-50 hover:scale-105 ${
        isActive
          ? "bg-emerald-100 text-[#003527]"
          : "bg-emerald-50 text-[#003527]/70 hover:bg-emerald-100"
      }`}
    >
      {icon && <i className={`fa-solid ${icon} text-xs`} />}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:text-red-600 cursor-pointer text-slate-500 ml-1 inline-flex items-center justify-center"
        >
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      )}
    </div>
  );
}
