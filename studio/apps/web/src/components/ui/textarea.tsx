import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex field-sizing-content min-h-16 w-full rounded-key border border-border bg-input px-2.5 py-2 text-body transition-[border-color,background-color] outline-none placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-signal focus-visible:outline-1 focus-visible:-outline-offset-0 focus-visible:outline-signal disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:outline-1 aria-invalid:outline-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
