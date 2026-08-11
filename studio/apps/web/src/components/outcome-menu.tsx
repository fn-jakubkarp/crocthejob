import { Check } from "lucide-react";
import { Fragment } from "react";
import {
	ContextMenuItem,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { OUTCOME_GROUPS, OUTCOMES_BY_GROUP, type OutcomeId } from "@/lib/jobs";

/**
 * How an application ended, as menu rows under their two headings. One definition, used
 * by the card's own menu and by the rows on the stats page, so the words on offer for
 * closing an entry are the same wherever the entry is closed from.
 *
 * `closeOnClick={false}`: the tags combine - quiet *after* the technical is two of them -
 * so the menu stays up until it is dismissed.
 */
export function OutcomeItems({
	held,
	onPick,
}: {
	/** Tags the entry already carries, or null when the menu acts on a selection. */
	held: ReadonlySet<OutcomeId> | null;
	onPick: (tag: OutcomeId) => void;
}) {
	return (
		<>
			{OUTCOME_GROUPS.map((group, i) => (
				<Fragment key={group.id}>
					{i > 0 && <ContextMenuSeparator />}
					{/* Not ContextMenuLabel: base-ui's is MenuGroupLabel and throws outside
					    a Menu.Group. Decorative - the rows below say what they are. */}
					<p
						aria-hidden
						className="text-muted-foreground px-1.5 py-1 text-xs font-medium"
					>
						{group.label}
					</p>
					{OUTCOMES_BY_GROUP[group.id].map((tag) => (
						<ContextMenuItem
							key={tag.id}
							closeOnClick={false}
							onClick={() => onPick(tag.id)}
						>
							{held?.has(tag.id) ? <Check /> : <span className="w-4" />}
							{tag.label}
						</ContextMenuItem>
					))}
				</Fragment>
			))}
		</>
	);
}
