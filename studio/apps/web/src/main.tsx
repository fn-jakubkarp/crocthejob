import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SetupProvider } from "@/components/setup/provider";
import App from "./App.tsx";

// The pre-paint `.dark` class is set in index.html.
const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
	<StrictMode>
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			{/* Inside the theme provider: the wizard sets the plate through it. */}
			<SetupProvider>
				<App />
			</SetupProvider>
		</ThemeProvider>
	</StrictMode>,
);
