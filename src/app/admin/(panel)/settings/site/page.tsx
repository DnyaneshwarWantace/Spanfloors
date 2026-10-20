import SettingsForm from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { settingsForAdmin } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  await requireUser();
  const rows = (await settingsForAdmin()).filter((r) => r.group === "site" || r.group === "seo");
  return (
    <>
      <PageHeader title="Site settings" description="Contact details, social links and search defaults used across the website." />
      <SettingsForm
        group="site"
        rows={rows}
        sections={[
          { title: "Business details", keys: ["site.name", "site.phone", "site.email", "site.address"] },
          { title: "Social links", keys: ["site.instagram", "site.facebook", "site.linkedin"] },
          {
            title: "Search engine defaults",
            description: "Used on pages that don’t set their own SEO title or description.",
            keys: ["seo.defaultTitle", "seo.defaultDescription"],
          },
        ]}
      />
    </>
  );
}
