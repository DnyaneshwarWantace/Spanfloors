import TextsEditor from "@/components/admin/TextsEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { getConfig, TEXT_DEFAULTS, TEXT_LABELS } from "@/server/site-config";

export const dynamic = "force-dynamic";

export default async function TextsPage() {
  await requireUser("settings.site");
  const saved = await getConfig("config.texts");
  return (
    <>
      <PageHeader title="Shared texts" description="Words used on many pages: form buttons and thank-you messages, footer and blog labels. Change one here and every page updates." />
      <TextsEditor defaults={{ ...TEXT_DEFAULTS }} saved={saved} groups={TEXT_LABELS} />
    </>
  );
}
