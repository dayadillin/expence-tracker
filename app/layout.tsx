import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}