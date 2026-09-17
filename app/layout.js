import "./globals.css";

export const metadata = {
  title: "nitro, Shahir Ahmed's home server",
  description: "The old laptop that runs my project backends, with live stats from the machine.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
