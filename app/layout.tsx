import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import RainbowGradientDefs from "../components/RainbowGradientDefs";

export const metadata = {
  title: "Expense Tracker",
  description: "Personal expense tracking application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <RainbowGradientDefs />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}