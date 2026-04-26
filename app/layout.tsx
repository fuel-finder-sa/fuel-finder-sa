export const metadata = {
  title: "Fuel Finder SA",
  description: "Find the best fuel stations near you",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}