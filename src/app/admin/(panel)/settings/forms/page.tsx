import SettingsForm from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { settingsForAdmin } from "@/server/settings";
import { getConfig } from "@/server/site-config";
import FormFieldsEditor from "@/components/admin/FormFieldsEditor";

export const dynamic = "force-dynamic";

export default async function FormsSettingsPage() {
  await requireUser("settings.forms");
  const [rows, formsConfig] = await Promise.all([settingsForAdmin().then((all) => all.filter((r) => r.group === "forms")), getConfig("config.forms")]);
  return (
    <>
      <PageHeader title="Forms & bookings" description="Where website leads are emailed, the customer auto-reply, WhatsApp, and booking availability." />
      <SettingsForm
        group="forms"
        rows={rows}
        sections={[
          {
            title: "Lead emails",
            description:
              'Recipients per form type as JSON, e.g. {"default": "sales@spanfloors.com", "dealer": "partners@spanfloors.com", "sample": ["samples@spanfloors.com"]}. Types: enquiry, sample, download, dealer, video_call, visit, landing. Falls back to “Send enquiries to” in Integrations.',
            keys: ["forms.recipients", "forms.autoReply", "forms.whatsapp"],
          },
          {
            title: "Booking availability",
            description:
              'JSON with timezone, slotMinutes, minNoticeHours, daysAhead, hours per booking type (video_call, visit) by weekday 0–6 (0 = Sunday) as "HH:MM-HH:MM" ranges, and blockedDates as "YYYY-MM-DD".',
            keys: ["bookings.config"],
          },
        ]}
      />
      <h2 className="mt-12 mb-1 text-title">Form fields</h2>
      <p className="mb-5 max-w-3xl text-2xs text-muted">Choose which extra questions each website form asks. Fewer questions usually means more enquiries.</p>
      <FormFieldsEditor saved={formsConfig} />
    </>
  );
}
