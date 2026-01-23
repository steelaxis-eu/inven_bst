"use client";

import * as React from "react";
import {
    FluentProvider,
    SSRProvider,
    RendererProvider,
    createDOMRenderer,
    renderToStyleElements,
} from "@fluentui/react-components";
import { useTheme } from "next-themes";
import { appLightTheme, appDarkTheme } from "@/lib/theme";

type AppProviderProps = {
    children: React.ReactNode;
};

export function AppFluentProvider({ children }: AppProviderProps) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const theme = resolvedTheme === "dark" ? appDarkTheme : appLightTheme;

    // Prevent hydration mismatch by defining a default theme until mounted
    // or just render functionality once mounted if acceptable, 
    // but better to render with a default and switch.
    // However, for pure client side theme switch, we can just use the theme.

    if (!mounted) {
        return null
    }

    return (
        <FluentProvider theme={theme}>
            {children}
        </FluentProvider>
    );
}
