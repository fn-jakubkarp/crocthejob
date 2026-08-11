"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "transparent",
					"--border-radius": "10px",
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					// The build's one float elevation, not sonner's own shadow.
					toast: "elev-float border-0! text-body font-medium",
					description: "text-muted-foreground text-meta!",
					// Sonner's default is the palette inverted - a white slab on a dark
					// toast. Undo is the build's secondary key instead: a plane and a
					// hairline, lighter than the toast in dark and darker in light.
					// `!` because sonner's own rule outranks a utility on specificity.
					actionButton:
						"rounded-chip! bg-secondary! px-2! text-meta! font-medium! text-secondary-foreground! transition-colors! hover:bg-card-hover! active:bg-surface!",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
