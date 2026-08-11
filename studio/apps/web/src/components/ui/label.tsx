import * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		<label
			data-slot="label"
			className={cn(
				// The `legend` register, matching the details panel. Plain `text-sm` sat above
				// the 12.5px body scale and read louder than the value it names.
				"legend flex items-center gap-2 text-data leading-none text-muted-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
