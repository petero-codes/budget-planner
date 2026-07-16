import "./globals.css";

export const metadata = {
  title: "KenGen ICT Budgeting Portal",
  description: "Annual budgeting approval portal for KenGen ICT",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
