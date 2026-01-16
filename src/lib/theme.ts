import { createDarkTheme, createLightTheme, BrandVariants, Theme } from "@fluentui/react-components";

const brandBlue: BrandVariants = {
    10: "#000306",
    20: "#01162B",
    30: "#022543",
    40: "#033158",
    50: "#053E70",
    60: "#074D89",
    70: "#095CA3",
    80: "#0F6CBD", // Primary
    90: "#287DC5",
    100: "#3F8DCC",
    110: "#559DD3",
    120: "#6BADDB",
    130: "#81BCE2",
    140: "#97CBE9",
    150: "#AEDAF0",
    160: "#C4E9F7",
};

export const appLightTheme: Theme = createLightTheme(brandBlue);
export const appDarkTheme: Theme = createDarkTheme(brandBlue);
