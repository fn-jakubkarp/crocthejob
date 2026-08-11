import type { Section } from "@/hooks/use-outline";
import { cn } from "@/lib/utils";

/**
 * Where you are in a long document. Deliberately without a plate of its own: the index
 * and the sheet are the two objects on this page, and a third box would make the
 * reading column the middle of a sandwich. It is type on the panel, hung off one
 * groove, with the section you are in lit on that groove.
 *
 * Under three headings there is nothing to navigate, and the page is better without
 * the column.
 */
export function Outline({
	sections,
	active,
}: {
	sections: Section[];
	active: number;
}) {
	if (sections.length < 3) return null;

	return (
		<nav
			aria-label="Document outline"
			className="sticky top-0 hidden shrink-0 self-start py-11 xl:block"
		>
			<p className="label text-muted-foreground mb-2 pl-3 text-legend">
				Contents
			</p>
			<div className="relative max-h-[calc(100vh-10rem)] overflow-y-auto">
				<div className="rule-v absolute inset-y-0 left-0" />
				{sections.map((section, index) => (
					<button
						key={section.key}
						type="button"
						onClick={() =>
							section.el.scrollIntoView({
								behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
									.matches
									? "auto"
									: "smooth",
								block: "start",
							})
						}
						aria-current={index === active ? "true" : undefined}
						className={cn(
							"block w-full py-1 pr-1 pl-3 text-left text-meta leading-snug transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
							section.depth === 3 && "pl-6",
							index === active
								? "text-signal-ink font-medium shadow-[inset_1px_0_0_0_var(--signal)]"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<span className="line-clamp-2">{section.text}</span>
					</button>
				))}
			</div>
		</nav>
	);
}
