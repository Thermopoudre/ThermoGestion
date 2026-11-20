import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-brand">← Thermogestion</Link>
      <article className="prose-sm mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-gray-700 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-sm [&_li]:text-gray-700">
        {children}
      </article>
      <p className="mt-10 text-xs text-gray-500">
        Document fourni à titre informatif — faites-le relire par votre conseil juridique.
      </p>
    </div>
  );
}
