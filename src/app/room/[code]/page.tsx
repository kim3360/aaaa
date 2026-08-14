import RoomGate from '@/components/RoomGate';

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomGate code={code} view="lobby" />;
}
