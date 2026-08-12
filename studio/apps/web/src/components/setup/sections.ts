/**
 * The four decisions a first run settles, named once for both shells: the full-bleed
 * intake sheet on the first run, the compact dialog from the rail afterwards. Its own
 * module rather than steps.tsx, for the reason button-variants.ts is: a non-component
 * export alongside a component costs Fast Refresh the ability to preserve state.
 */

export type SectionId = "mode" | "board" | "import" | "docs";

export type Section = {
	id: SectionId;
	/** The spine's and the dialog's word for it. */
	label: string;
	/** The sheet's heading. */
	title: string;
	line: string;
};

export const SECTIONS: readonly Section[] = [
	{
		id: "mode",
		label: "Mode",
		title: "How you run it",
		line: "Whether the local Claude Code is part of this board.",
	},
	{
		id: "board",
		label: "Board",
		title: "How it opens",
		line: "Every one of these moves again later, from the dock.",
	},
	{
		id: "import",
		label: "Import",
		title: "Jobs you already have",
		line: "Optional. A jobs file from another checkout, folded into this one.",
	},
	{
		id: "docs",
		label: "Documents",
		title: "What a CV is cut from",
		line: "Three files, written straight into the repo.",
	},
];

/** Offline never reaches the documents: they are what Claude writes a CV from. */
export function sectionsFor(ai: boolean): Section[] {
	return SECTIONS.filter((section) => section.id !== "docs" || ai);
}
