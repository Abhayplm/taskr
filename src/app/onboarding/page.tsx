'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/contexts/OrgContext';

export default function OnboardingPage() {
  const { loading: orgLoading } = useOrg();
  const router = useRouter();

  useEffect(() => {
    if (!orgLoading) {
      router.push('/dashboard');
    }
  }, [orgLoading, router]);

  return (
    <div className="loading-screen">
      <div className="spinner spinner-lg" />
      <p className="text-secondary text-sm">Loading your workspace...</p>
    </div>
  );
}
