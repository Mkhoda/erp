import React from "react";

type Props = {
  cols?: number;
  rows?: number;
};

export default function SkeletonTable({ cols = 5, rows = 6 }: Props) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-theme last:border-0">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <div
                className="skeleton rounded h-4"
                style={{ width: ci === 0 ? "60%" : ci === cols - 1 ? "40%" : `${50 + Math.random() * 40}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-theme p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="flex gap-2 mt-2">
            <div className="skeleton h-8 flex-1 rounded-lg" />
            <div className="skeleton h-8 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </>
  );
}
