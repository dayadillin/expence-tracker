'use client';

import dynamic from 'next/dynamic';

const TrackerApp = dynamic(() => import('../components/TrackerApp'), {
  ssr: false,
  loading: () => (
    <div className="finance-app app-shell-bg relative min-h-screen flex items-center justify-center">
      <div className="relative z-10 w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function Page() {
  return <TrackerApp />;
}
