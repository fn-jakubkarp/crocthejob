import { cva } from "class-variance-authority";

/**
 * Its own module rather than button.tsx: a non-component export alongside a component
 * costs Fast Refresh the ability to preserve state on edit, so the whole tree reloads.
 *
 * Every variant is a plane and a hairline. Nothing here casts a shadow: a button is
 * raised because it is lighter than what it sits on, and pressed because it is darker.
 * The border is declared transparent on the base so a filled variant and an outlined
 * one are the same box, and only the colour changes between them.
 */
export const buttonVariants = cva(
	// Explicit list, not `transition-all`: that animates width, padding and font-size
	// through 150ms of reflow.
	"group/button inline-flex shrink-0 items-center justify-center rounded-key border border-transparent text-body font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,translate] duration-150 ease-out outline-none select-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal disabled:pointer-events-none disabled:opacity-45 aria-invalid:outline-2 aria-invalid:outline-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))] active:bg-[color-mix(in_oklab,var(--primary)_78%,var(--foreground))]",
				outline:
					"border-border bg-card text-foreground hover:border-border-strong hover:bg-card-hover active:bg-surface aria-expanded:border-border-strong aria-expanded:bg-surface aria-expanded:text-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-card-hover active:bg-surface",
				ghost:
					"text-foreground hover:bg-card active:bg-surface aria-expanded:bg-card aria-expanded:text-foreground",
				destructive:
					"border-[color-mix(in_oklab,var(--destructive)_28%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_11%,transparent)] text-destructive hover:border-[color-mix(in_oklab,var(--destructive)_45%,transparent)] hover:bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)] focus-visible:outline-destructive",
				link: "text-signal-ink underline-offset-4 hover:underline",
			},
			size: {
				default:
					"h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				xs: "h-6 gap-1 rounded-chip px-2 text-meta has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 px-2.5 text-body has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				lg: "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				icon: "size-8",
				"icon-xs": "size-6 rounded-chip [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);
