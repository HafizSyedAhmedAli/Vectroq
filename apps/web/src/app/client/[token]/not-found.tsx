export default function ExpiredLink() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold text-brand-black">
        This link is no longer available
      </h1>
      <p className="mt-3 text-sm text-stone-500">
        It may have expired or been replaced. Please ask your contractor for a
        new link.
      </p>
    </main>
  );
}
