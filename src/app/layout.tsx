import "./globals.css";

export const metadata = {
  title: "KenGen ICT Budgeting Portal",
  description: "Annual budgeting approval portal for KenGen ICT",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
