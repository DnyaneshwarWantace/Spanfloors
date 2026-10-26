/* The product collections (shared by server and client code). URLs match the existing spanfloors.com URLs. */

export type CategoryKey = "engineered" | "laminate" | "composite" | "decking" | "facades" | "accessories";

export type Category = {
  key: CategoryKey;
  /** URL segment — matches the existing spanfloors.com URLs where one exists, to keep SEO. */
  slug: string;
  title: string;
  intro: string;
};

export const CATEGORIES: Category[] = [
  {
    key: "engineered",
    slug: "engineered-wood-flooring-collection",
    title: "Engineered Wood Flooring",
    intro:
      "Real timber wear layers over a stable multi-layer core. Planks, herringbone and chevron in European oak, walnut and teak, finished and ready to lay.",
  },
  {
    key: "laminate",
    slug: "laminate-flooring-collection",
    title: "Laminate Flooring",
    intro: "Hard-wearing laminate with authentic wood visuals, built for busy homes and easy upkeep.",
  },
  {
    key: "composite",
    slug: "composite-flooring-collection",
    title: "Composite Flooring",
    intro: "Composite floors that pair the look of wood with resistance to moisture and daily wear.",
  },
  {
    key: "decking",
    slug: "decking-collection",
    title: "Decking",
    intro: "Exterior timber and composite decking for terraces, pool surrounds and gardens.",
  },
  {
    key: "facades",
    slug: "facades-collection",
    title: "Facades",
    intro: "Timber cladding, fluted profiles and screening for exteriors that age beautifully.",
  },
  {
    key: "accessories",
    slug: "accessories",
    title: "Accessories",
    intro: "Skirting, profiles, underlays, adhesives and care products to finish every installation.",
  },
];
