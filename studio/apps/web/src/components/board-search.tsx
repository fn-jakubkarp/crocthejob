import { Search, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
	value: string;
	onChange: (value: string) => void;
	/** The population the filter draws from. */
	total: number;
	/** How many survive it. */
	showing: number;
	/** Whether hidden copies are on screen, which is what the count is *of*. */
	countingEntries: boolean;
};

/**
 * A key at rest, a field once you reach for it. The input is always mounted and
 * only clipped to nothing, so the key can hand focus straight to it and the
 * browser keeps it in the tab order either way.
 */
export function BoardSearch({
	value,
	onChange,
	total,
	showing,
	countingEntries,
}: Props) {
	const field = useRef<HTMLInputElement>(null);
	const [focused, setFocused] = useState(false);
	// A query holds the field open after blur: it is the thing the board is
	// filtered by, and it has to stay visible and clearable.
	const open = focused || value !== "";
	const narrowing = showing !== total;

	return (
		<div
			data-open={open || undefined}
			className="group/search flex items-center"
		>
			{/* The glyph morphs to an X once there is something to clear, so one key
			    both opens the field and empties it. */}
			<Button
				variant="outline"
				size="sm"
				className="gap-0 px-2.5"
				aria-label={value ? "Clear the filter" : "Filter the board"}
				onClick={() => {
					if (value) onChange("");
					field.current?.focus();
				}}
			>
				<MorphIcon
					icon={value ? X : Search}
					spring="snappy"
					className="size-3.5"
					strokeWidth={2}
				/>
			</Button>

			<span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-data-open/search:grid-cols-[1fr] motion-reduce:transition-none">
				{/* The clip is its own element and carries no padding: padding on a grid
				    item survives a zero track and would leave a sliver beside the key. */}
				<span className="overflow-hidden">
					<span className="relative block pl-1.5">
						<Input
							ref={field}
							// What `/` focuses. The field is always mounted and only clipped to
							// nothing, so focusing it is all the shortcut has to do - `onFocus`
							// opens the clip, exactly as the key beside it does.
							id="board-search"
							value={value}
							onChange={(e) => onChange(e.target.value)}
							onFocus={() => setFocused(true)}
							onBlur={() => setFocused(false)}
							onKeyDown={(e) => {
								if (e.key !== "Escape") return;
								onChange("");
								field.current?.blur();
							}}
							placeholder="Company, title or note…"
							// Fixed width, which is what the 1fr track resolves against.
							// Right padding leaves room for the count.
							className="w-52 pr-14"
						/>
						{/* `aria-live`, so the count is announced, not only seen. Spoken form
						    is the long one - "42/385" reads as a fraction out loud. */}
						<span
							aria-live="polite"
							className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-data text-data tabular-nums"
						>
							<span aria-hidden>
								{narrowing ? `${showing}/${total}` : total}
							</span>
							<span className="sr-only">
								{narrowing
									? `${showing} of ${total} shown`
									: `${total} ${countingEntries ? "entries" : "postings"}`}
							</span>
						</span>
					</span>
				</span>
			</span>
		</div>
	);
}
