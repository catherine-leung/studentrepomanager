// app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center 
                     justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Classroom Manager
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          GitHub App for managing student repositories
        </p>
        <div className="space-x-4">
          <a
            href="/api/auth/login"
            className="bg-blue-600 text-white px-6 py-2 
                       rounded hover:bg-blue-700"
          >
            Login with GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
