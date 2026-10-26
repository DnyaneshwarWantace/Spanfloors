import MenuEditor from "@/components/admin/MenuEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { getConfig } from "@/server/site-config";

export const dynamic = "force-dynamic";

export default async function MenusPage() {
  await requireUser("settings.site");
  const [header, footer] = await Promise.all([getConfig("config.header"), getConfig("config.footer")]);
  return (
    <>
      <PageHeader title="Menus" description="The header menu (with dropdowns and an optional button) and the footer links. Pick pages from the list or paste an address." />
      <MenuEditor header={header} footer={footer} />
    </>
  );
}
