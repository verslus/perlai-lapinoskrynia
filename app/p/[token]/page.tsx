import { PortalFlow } from "@/components/PortalFlow";

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main>
      <PortalFlow token={token} />
    </main>
  );
}
