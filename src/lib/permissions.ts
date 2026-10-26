/* Who can do what in the admin. Shared by server checks and the admin menu. */

export type Role = "admin" | "editor" | "author" | "sales";

export type Permission =
  | "dashboard"
  | "leads"
  /** Create and edit blog posts and pages. */
  | "content"
  /** Publish, schedule or archive (authors send for review instead). */
  | "content.publish"
  /** Edit pages, fixed site pages and other people's posts (authors only edit their own posts). */
  | "content.all"
  | "media"
  | "products"
  | "redirects"
  | "settings.site"
  | "settings.forms"
  | "settings.integrations"
  | "users";

const EDITOR: Permission[] = ["dashboard", "leads", "content", "content.publish", "content.all", "media", "products", "redirects", "settings.site", "settings.forms"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [...EDITOR, "settings.integrations", "users"],
  editor: EDITOR,
  author: ["dashboard", "content", "media"],
  sales: ["dashboard", "leads"],
};

export const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Everything, including users and API keys" },
  { value: "editor", label: "Editor", hint: "Pages, blog, media, products, leads, site settings" },
  { value: "author", label: "Author", hint: "Writes blog posts; an editor publishes them" },
  { value: "sales", label: "Sales", hint: "Leads only" },
];

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
}
