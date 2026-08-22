import { redirect } from 'next/navigation';
import { ANCHOR_RESTAURANT_ID } from '@/lib/fixtures';

/** Restaurant-owner entry point. The dashboard itself carries a restaurant switcher. */
export default function DashboardEntry() {
  redirect(`/restaurant/${ANCHOR_RESTAURANT_ID}`);
}
