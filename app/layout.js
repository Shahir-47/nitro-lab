import "./globals.css";

export const metadata = {
  title: "Shahir's Home Server",
  description: "A self-hosted Linux server that runs Shahir Ahmed's project backends, with live system metrics and architecture.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
