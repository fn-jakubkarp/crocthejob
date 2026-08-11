import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
	/** ISO string YYYY-MM-DD */
	value?: string;
	/** Called with ISO string YYYY-MM-DD */
	onChange?: (value: string) => void;
	className?: string;
	placeholder?: string;
	/** The trigger carries the accessible name: a `<label>` cannot name a button. */
	"aria-label"?: string;
};

export function DatePicker({
	value,
	onChange,
	className,
	placeholder = "Pick a date",
	"aria-label": ariaLabel,
}: DatePickerProps) {
	const date = value ? parseISO(value) : undefined;

	const handleSelect = (d: Date | undefined) => {
		if (onChange) {
			if (d) {
				onChange(format(d, "yyyy-MM-dd"));
			} else {
				onChange("");
			}
		}
	};

	return (
		<Popover>
			{/* `render`, not `asChild`: base-ui composes through a render prop, and
			    `asChild` is silently not a prop here. */}
			<PopoverTrigger
				render={
					<Button
						variant="outline"
						aria-label={ariaLabel}
						className={cn(
							"justify-start text-left font-normal border-border bg-input",
							!date && "text-muted-foreground",
							className,
						)}
					/>
				}
			>
				<CalendarIcon className="size-3.5 shrink-0" />
				<span className="truncate leading-none pt-px">
					{date ? format(date, "PPP") : placeholder}
				</span>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				{/* react-day-picker v10 renamed `initialFocus`. */}
				<Calendar
					mode="single"
					selected={date}
					onSelect={handleSelect}
					autoFocus
				/>
			</PopoverContent>
		</Popover>
	);
}
