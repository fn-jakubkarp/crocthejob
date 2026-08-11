import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				// Focus doubles the field's own edge in signal rather than hanging a
				// halo off it: 1px border plus a 1px outline at zero offset is a
				// crisp 2px accent perimeter and shifts nothing.
				"h-8 w-full min-w-0 rounded-key border border-border bg-input px-2.5 py-1 text-body transition-[border-color,background-color] outline-none placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-signal focus-visible:outline-1 focus-visible:-outline-offset-0 focus-visible:outline-signal disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:outline-1 aria-invalid:outline-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
