import { Moon, Sun } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useTheme } from "next-themes";
import { DockLabel } from "@/components/dock-label";
import { Button } from "@/components/ui/button";

/**
 * `resolvedTheme` is undefined until next-themes reads storage, so the glyph waits
 * rather than rendering the wrong one and flipping.
 */
export function ThemeKey() {
	const { resolvedTheme, setTheme } = useTheme();
	const dark = resolvedTheme === "dark";

	return (
		<Button
			variant="outline"
			size="sm"
			className="gap-0 px-2.5"
			onClick={() => setTheme(dark ? "light" : "dark")}
			aria-label={
				dark ? "Switch to the light plate" : "Switch to the dark plate"
			}
		>
			{resolvedTheme ? (
				<MorphIcon
					icon={dark ? Sun : Moon}
					spring="snappy"
					className="size-3.5"
					strokeWidth={2}
				/>
			) : (
				<span className="size-3.5" />
			)}
			{/* "Plate", not the theme being switched to: the label must not change
			    width under the pointer while it is open. */}
			<DockLabel>Plate</DockLabel>
		</Button>
	);
}
