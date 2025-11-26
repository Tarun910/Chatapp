import './globals.css';

export const metadata = {
  title: 'Realtime Chat',
  description: 'Realtime chat experience powered by Next.js and Socket.io',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

