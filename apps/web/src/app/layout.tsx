import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { platformBrand as brand } from "@/lib/brand";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vectroq.vercel.app"),
  title: brand.name,
  description: brand.description,
};

// Dark mode is only allowed on the landing page, the demo and the auth pages.
const THEME_SCRIPT = `try{var p=location.pathname;var d=["/demo","/login","/signup","/forgot-password","/reset-password","/verify-email","/invite"];if(p==="/"||d.some(function(x){return p===x||p.indexOf(x+"/")===0})){var t=localStorage.getItem("vq_theme");if(t==="dark"||(t===null&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-stone-50 font-sans text-stone-900 antialiased dark:bg-[#050b1a]">
        {children}
      </body>
    </html>
  );
}
