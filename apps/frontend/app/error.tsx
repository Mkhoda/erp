'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex justify-center items-center bg-theme-secondary min-h-screen">
      <div className="text-center">
        <h1 className="font-bold text-red-600 text-6xl">خطا!</h1>
        <p className="mt-4 text-theme-secondary text-xl">مشکلی پیش آمده است</p>
        <button
          onClick={reset}
          className="inline-block bg-blue-600 hover:bg-blue-700 mt-6 px-6 py-3 rounded-lg text-white"
        >
          تلاش مجدد
        </button>
      </div>
    </div>
  );
}
