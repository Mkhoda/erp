'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#111827' }}>خطا!</h1>
            <p style={{ marginTop: '1rem', fontSize: '1.25rem', color: '#4b5563' }}>مشکلی در سرور رخ داده است</p>
            <button 
              onClick={reset}
              style={{ 
                marginTop: '1.5rem', 
                padding: '0.75rem 1.5rem', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                borderRadius: '0.5rem', 
                border: 'none', 
                cursor: 'pointer' 
              }}
            >
              تلاش مجدد
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
