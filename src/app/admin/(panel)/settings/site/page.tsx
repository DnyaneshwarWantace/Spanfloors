import Link from "next/link";
import SettingsForm from "@/components/admin/SettingsForm";
import SiteConfigEditor from "@/components/admin/SiteConfigEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { settingsForAdmin } from "@/server/settings";
import { getConfig, identityUrls } from "@/server/site-config";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  const user = await requireUser("settings.site");
  const [rows, identity, contact, studios, tracking, cookies, announcement, urls] = await Promise.all([
    settingsForAdmin(),
    getConfig("config.identity"),
    getConfig("config.contact"),
    getConfig("config.studios"),
    getConfig("config.tracking"),
    getConfig("config.cookies"),
    getConfig("config.announcement"),
    identityUrls(),
  ]);
  return (
    <>
      <PageHeader
        title="Site settings"
        description={
          <>
            Logo, contact details, studios, tracking and banners used across the website. Menus are under{" "}
            <Link href="/admin/settings/menus/" className="underline">
              Menus
            </Link>
            , repeated words under{" "}
            <Link href="/admin/settings/texts/" className="underline">
              Shared texts
            </Link>
            .
          </>
        }
      />
      <div className="grid gap-6">
        <SiteConfigEditor initial={{ identity, contact, studios, tracking, cookies, announcement }} urls={urls} canEditTracking={can(user.role, "settings.integrations")} />
        <SettingsForm
          group="site"
          rows={rows.filter((r) => r.group === "site" || r.group === "seo")}
          sections={[
            { title: "Business name", keys: ["site.name"] },
            {
              title: "Search engine defaults",
              description: "Used on pages that don’t set their own SEO title or description.",
              keys: ["seo.defaultTitle", "seo.defaultDescription"],
            },
            {
              title: "AI search (llms.txt)",
              description: "What AI answer engines read first about Span Floors, at spanfloors.com/llms.txt.",
              keys: ["seo.aiSummary", "seo.aiFacts"],
            },
          ]}
        />
      </div>
    </>
  );
}
