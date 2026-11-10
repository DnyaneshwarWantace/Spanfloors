import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import Dropdown from "@/components/ui/Dropdown";
import { EmptyState, PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const SERVICES = [
  { value: "", label: "All services" },
  { value: "email", label: "Email" },
  { value: "twenty", label: "Twenty CRM" },
  { value: "allsy", label: "Allsy.io" },
  { value: "indexnow", label: "Search engine pings" },
];

export default async function IntegrationLog({ searchParams }: { searchParams: Promise<{ service?: string; failed?: string }> }) {
  await requireUser("settings.integrations");
  const sp = await searchParams;
  const where: SQL[] = [];
  if (sp.service && SERVICES.some((s) => s.value === sp.service)) where.push(eq(schema.integrationLog.service, sp.service));
  if (sp.failed === "1") where.push(eq(schema.integrationLog.ok, false));
  const rows = await db
    .select({ id: schema.integrationLog.id, service: schema.integrationLog.service, action: schema.integrationLog.action, ok: schema.integrationLog.ok, message: schema.integrationLog.message, createdAt: schema.integrationLog.createdAt, user: schema.users.name })
    .from(schema.integrationLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.integrationLog.userId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.integrationLog.createdAt))
    .limit(300);
  const label = (s: string) => SERVICES.find((x) => x.value === s)?.label ?? s;

  return (
    <>
      <PageHeader
        title="Integration log"
        description={
          <>
            Emails sent, leads copied to Twenty and connection checks from the last 90 days.{" "}
            <Link href="/admin/settings/integrations/" className="underline">
              Back to integrations
            </Link>
          </>
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-3">
        <Dropdown name="service" defaultValue={sp.service ?? ""} options={SERVICES} submitOnChange size="sm" aria-label="Service" className="w-48" />
        <label className="flex items-center gap-2 text-2xs">
          <input type="checkbox" name="failed" value="1" defaultChecked={sp.failed === "1"} />
          Only problems
        </label>
        <button className="text-2xs underline">Apply</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Nothing logged yet" />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[44rem] text-left text-2xs">
            <thead className="bg-paper-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Service</th>
                <th className="px-4 py-2.5 font-medium">What</th>
                <th className="px-4 py-2.5 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{r.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-4 py-2.5">{label(r.service)}</td>
                  <td className="px-4 py-2.5">
                    {r.action}
                    {r.user && <span className="text-muted"> · {r.user}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={r.ok ? "text-[#2f6339]" : "text-brand"}>{r.ok ? "OK" : "Problem"}</span>
                    {r.message && <span className="text-muted"> · {r.message}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
