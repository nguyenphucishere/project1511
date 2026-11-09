export default async function MissionRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <div>Mission Room Placeholder: {id}</div>;
}
