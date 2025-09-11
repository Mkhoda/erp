export default function NotFound() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-center">
        <h1 className="font-bold text-gray-900 text-6xl">404</h1>
        <p className="mt-4 text-gray-600 text-xl">صفحه مورد نظر پیدا نشد</p>
        <a href="/" className="inline-block bg-blue-600 hover:bg-blue-700 mt-6 px-6 py-3 rounded-lg text-white">
          بازگشت به خانه
        </a>
      </div>
    </div>
  );
}
