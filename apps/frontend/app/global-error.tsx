'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <h1 className="font-bold text-gray-900 text-6xl">خطا!</h1>
            <p className="mt-4 text-gray-600 text-xl">مشکلی در سرور رخ داده است</p>
            <button 
              onClick={reset}
              className="inline-block bg-blue-600 hover:bg-blue-700 mt-6 px-6 py-3 rounded-lg text-white"
            >
              تلاش مجدد
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
