import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-16">
      <h1 className="text-3xl font-extrabold text-brand-black">
        Create your company
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        You get your own intake form, rates library and branding. Sample rates
        are included so you can try a BOQ straight away.
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
    </main>
  );
}
