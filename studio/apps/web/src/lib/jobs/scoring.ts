import type { Job } from "./types";

/** The four axes /rank scores separately. */
export const DIMENSIONS = [
	{ id: "technical", label: "Technical" },
	{ id: "experience", label: "Experience" },
	{ id: "behavioral", label: "Behavioural" },
	{ id: "career", label: "Career" },
] as const;

/** /scrape's pre-check off a search-result blurb, best first. */
const FIT_ORDER = ["high", "medium", "low"] as const;

/**
 * 75+ apply, 60-74 apply and address the gaps, below that think first. A scored card
 * lights from the score and drops `fit`, which is only the blurb-level pre-check.
 */
export function scoreLamp(score: number): "high" | "medium" | "low" {
	if (score >= 75) return "high";
	if (score >= 60) return "medium";
	return "low";
}

export const fitRank = (j: Job) => {
	const i = FIT_ORDER.indexOf((j.fit ?? "") as (typeof FIT_ORDER)[number]);
	return i === -1 ? FIT_ORDER.length : i;
};
