import SettingsForm from "@/components/admin/SettingsForm";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { settingsForAdmin } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function FormsSettingsPage() {
  await requireUser();
  const rows = (await settingsForAdmin()).filter((r) => r.group === "forms");
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
    </>
  );
}
