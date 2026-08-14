import BalanceRoom from '@/components/BalanceRoom';

export default async function BalanceRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <BalanceRoom code={code} />;
}
