import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "We are working on this — Know Your IT Hub",
  description: "Prototype of the visitor page shown when Know Your IT Hub hits a technical interruption.",
  robots: { index: false, follow: false },
};

export default function PrototypeUnavailableLayout({ children }: { children: React.ReactNode }) {
  return children;
}
