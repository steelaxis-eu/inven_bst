"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    makeStyles,
    tokens,
    TabList,
} from "@fluentui/react-components";
import { useTranslations } from "next-intl";
import { APP_CONFIG } from "@/lib/config";
import { UserNav } from "@/components/user-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ModeToggle } from "@/components/mode-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";

const useStyles = makeStyles({
    header: {
        width: "100%",
        // Remove padding here as it's handled by inner container
        backgroundColor: tokens.colorNeutralBackground1,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
    },
    logo: {
        textDecoration: "none",
        color: tokens.colorBrandForeground1,
        fontWeight: "bold",
        fontSize: "20px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        ":hover": {
            color: tokens.colorBrandForeground2,
        }
    },
    nav: {
        display: "flex",
        gap: "24px",
        "@media (max-width: 1024px)": {
            display: "none",
        },
    },
    navLink: {
        textDecoration: "none",
        color: tokens.colorNeutralForeground1,
        fontSize: "14px",
        fontWeight: "normal",
        padding: "8px 12px",
        borderRadius: tokens.borderRadiusMedium,
        ":hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
            color: tokens.colorNeutralForeground1Hover,
        }
    },
    navLinkSelected: {
        fontWeight: "bold",
        color: tokens.colorBrandForeground1,
        ":after": {
            content: "''",
            display: "block",
            height: "2px",
            backgroundColor: tokens.colorBrandForeground1,
            marginTop: "4px"
        }
    },
    actions: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
});

export function Header({ userEmail }: { userEmail?: string }) {
    const styles = useStyles();
    const t = useTranslations("Navigation");
    const pathname = usePathname();

    // Mapping paths to tabs
    const getSelectedValue = () => {
        if (pathname.includes("/stock")) return "stock";
        if (pathname.includes("/inventory")) return "inventory";
        if (pathname.includes("/usage")) return "usage";
        if (pathname.includes("/projects")) return "projects";
        if (pathname.includes("/customers")) return "customers";
        if (pathname.includes("/settings")) return "settings";
        if (pathname === "/" || pathname === "/en" || pathname === "/lv") return "dashboard"; // simplistic check
        return undefined;
    };

    const selectedValue = getSelectedValue();

    return (
        <header className={styles.header}>
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MobileNav />
                    <Link href="/" className={styles.logo}>
                        {APP_CONFIG.name}
                    </Link>
                </div>

                <div className={styles.nav}>
                    <TabList
                        selectedValue={selectedValue}
                        onTabSelect={(e, data) => {
                            // Handle navigation programmatically to work with Fluent Tabs
                            // The functionality is managed by Links below, this is just for visual active state if needed
                        }}
                    >
                        {/* We will just use Links for now with Fluent styling to avoid complex router injection in this single call. */}
                    </TabList>
                    <nav className={styles.nav}>
                        <Link href="/" className={`${styles.navLink} ${selectedValue === 'dashboard' ? styles.navLinkSelected : ''}`}>
                            {t("dashboard")}
                        </Link>
                        <Link href="/stock" className={`${styles.navLink} ${selectedValue === 'stock' ? styles.navLinkSelected : ''}`}>
                            {t("stock")}
                        </Link>
                        <Link href="/inventory" className={`${styles.navLink} ${selectedValue === 'inventory' ? styles.navLinkSelected : ''}`}>
                            {t("inventory")}
                        </Link>
                        <Link href="/usage/history" className={`${styles.navLink} ${selectedValue === 'usage' ? styles.navLinkSelected : ''}`}>
                            {t("history")}
                        </Link>
                        <Link href="/projects" className={`${styles.navLink} ${selectedValue === 'projects' ? styles.navLinkSelected : ''}`}>
                            {t("projects")}
                        </Link>
                        <Link href="/customers" className={`${styles.navLink} ${selectedValue === 'customers' ? styles.navLinkSelected : ''}`}>
                            {t("customers")}
                        </Link>
                        <Link href="/settings" className={`${styles.navLink} ${selectedValue === 'settings' ? styles.navLinkSelected : ''}`}>
                            {t("settings")}
                        </Link>
                    </nav>
                </div>

                <div className={styles.actions}>
                    <LanguageSwitcher />
                    <ModeToggle />
                    <UserNav userEmail={userEmail} />
                </div>
            </div>
        </header>
    );
}
