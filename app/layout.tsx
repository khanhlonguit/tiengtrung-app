import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from './ThemeProvider';

export const metadata: Metadata = {
  title: 'Tiếng Trung Đương Đại 1',
  description: 'Học tiếng Trung qua giáo trình Đương Đại 1 — từ vựng, ngữ pháp, hội thoại và flashcard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
