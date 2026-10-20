"use server";

import { updateTag } from "next/cache";

/**
 * Drops the website's cached copy of Twenty data so the next page view re-reads it.
 * This only touches our own cache — it sends nothing to Twenty.
 */
export async function refreshFromTwenty() {
  updateTag("twenty");
}
