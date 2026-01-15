"use client";

import * as React from "react";
import {
    FluentProvider,
    teamsLightTheme,
    teamsDarkTheme,
    SSRProvider,
    RendererProvider,
    createDOMRenderer,
    renderToStyleElements,
} from "@fluentui/react-components";
import { useTheme } from "next-themes";

type AppProviderProps = {
    children: React.ReactNode;
};

export function AppFluentProvider({ children }: AppProviderProps) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const theme = resolvedTheme === "dark" ? teamsDarkTheme : teamsLightTheme;

    // Prevent hydration mismatch by defining a default theme until mounted
    // or just render functionality once mounted if acceptable, 
    // but better to render with a default and switch.
    // However, for pure client side theme switch, we can just use the theme.

    if (!mounted) {
        return (
            <FluentProvider theme={teamsLightTheme}>
                {children}
            </FluentProvider>
        )
    }

    return (
        <FluentProvider theme={theme}>
            {children}
        </FluentProvider>
    );
}
