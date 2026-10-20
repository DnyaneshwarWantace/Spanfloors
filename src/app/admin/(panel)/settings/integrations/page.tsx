import SettingsForm from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { settingsForAdmin } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireUser("admin");
  const rows = (await settingsForAdmin()).filter((r) => r.group === "integrations");
  return (
    <>
      <PageHeader
        title="Integrations & API keys"
        description="Keys are stored encrypted. Only the last 4 characters are ever shown. Admins only."
      />
      <SettingsForm
        group="integrations"
        rows={rows}
        showTwentyTest
        sections={[
          {
            title: "Twenty CRM (products)",
            description:
              "Products are only read from Twenty. The single exception: when “Send website leads” is yes, each website form creates a new Current Lead (plus a note with the details). Nothing in Twenty is ever updated or deleted.",
            keys: ["twenty.apiUrl", "twenty.apiKey", "twenty.refreshSeconds", "twenty.pushLeads"],
          },
          {
            title: "Allsy.io (images, project photos, brochures, videos)",
            description:
              "Allsy.io pushes changes to this website (signed with the push secret) and the website can also pull them with the API key. Product images are matched by Twenty’s allsyDecorImageId. Manage the sync under Allsy.io sync.",
            keys: ["allsy.apiUrl", "allsy.apiKey", "allsy.webhookSecret"],
          },
          {
            title: "Product image service",
            description:
              "Mode “allsy” (default) uses the synced Allsy.io media above. Other modes for a different image host. Mode “template”: public links like https://images.example.com/{id}.jpg. Mode “api”: a private API; the website fetches each image with the key on the server, caches it and serves it, so the key is never exposed. Use the Test button on any product to check an ID.",
            keys: ["images.mode", "images.urlTemplate", "images.apiUrl", "images.apiKey", "images.apiKeyHeader", "images.apiKeyPrefix", "images.jsonPath"],
          },
          { title: "Analytics", keys: ["analytics.gaId", "analytics.gtmId"] },
          { title: "Email (enquiry & sample forms)", keys: ["email.enquiryTo", "email.smtpHost", "email.smtpUser", "email.smtpPassword"] },
        ]}
      />
    </>
  );
}
