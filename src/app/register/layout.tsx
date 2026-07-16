/** Auth/public shells use client hooks — do not statically prerender. */
export const dynamic = "force-dynamic";

export default function AuthSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
