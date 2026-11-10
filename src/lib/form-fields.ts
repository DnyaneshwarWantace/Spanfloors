/**
 * Which extra fields each website form shows. Name and the fields a form can't work without (e.g. the delivery
 * address for samples) are always asked; the fields listed here can be set to optional, required or hidden in
 * Admin → Forms. Shared by the site form, the server checks and the admin editor.
 */

export type FieldMode = "optional" | "required" | "hidden";
export type FormKey = "enquiry" | "sample" | "download" | "dealer" | "video_call" | "visit";

export const FIELD_LABELS: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  profession: "I am a",
  city: "City",
  message: "Message",
  gstin: "GSTIN",
  yearsInBusiness: "Years in business",
};

export const FORM_LABELS: Record<FormKey, string> = {
  enquiry: "Enquiry",
  sample: "Free samples",
  download: "Guide / catalogue download",
  dealer: "Dealer application",
  video_call: "Architect video call",
  visit: "Studio visit",
};

/** The adjustable fields of each form with their default setting (the defaults match the original forms). */
export const FORM_FIELDS: Record<FormKey, Record<string, FieldMode>> = {
  enquiry: { phone: "optional", email: "optional", profession: "optional", city: "optional", message: "optional" },
  sample: { email: "optional", city: "hidden", message: "optional" },
  download: { phone: "hidden", city: "hidden" },
  dealer: { city: "optional", gstin: "optional", yearsInBusiness: "optional", message: "optional" },
  video_call: { phone: "optional", email: "optional", profession: "optional", city: "hidden", message: "optional" },
  visit: { phone: "optional", email: "optional", profession: "optional", city: "hidden", message: "optional" },
};

/** Forms that need a phone or an email (whichever the visitor gives): one of the two must stay visible. */
export const NEEDS_CONTACT: FormKey[] = ["enquiry", "video_call", "visit"];

export type FormsConfig = Partial<Record<string, Record<string, string>>>;

/** The settings for one form: saved choices over the defaults; unknown fields are ignored. */
export function fieldModes(cfg: FormsConfig | undefined, form: string): Record<string, FieldMode> {
  const defaults = FORM_FIELDS[form as FormKey] ?? {};
  const saved = cfg?.[form] ?? {};
  const out: Record<string, FieldMode> = {};
  for (const [f, def] of Object.entries(defaults)) {
    const v = saved[f];
    out[f] = v === "optional" || v === "required" || v === "hidden" ? v : def;
  }
  if (NEEDS_CONTACT.includes(form as FormKey) && out.phone === "hidden" && out.email === "hidden") out.phone = "optional";
  return out;
}
