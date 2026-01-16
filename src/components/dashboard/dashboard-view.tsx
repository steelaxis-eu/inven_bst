"use client";

import * as React from "react";
import Link from "next/link";
import {
    makeStyles,
    tokens,
    Text,
    Subtitle1,
    Title1,
    Card,
    CardHeader,
    CardFooter,
    CardPreview,
    Button,
    shorthands,
} from "@fluentui/react-components";
import {
    BoxMultipleRegular,
    ClipboardTaskRegular,
    FolderRegular,
    SearchRegular,
    SettingsRegular,
    ArrowRightRegular,
} from "@fluentui/react-icons";
import { CreateUsageDialog } from "@/components/create-usage-dialog";
// Note: CreateUsageDialog will be refactored later, assuming it accepts a trigger ReactNode.

const useStyles = makeStyles({
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        minHeight: "calc(100vh - 64px)", // adjust for header
        backgroundColor: tokens.colorNeutralBackground2, // light gray bg
    },
    content: {
        maxWidth: "1024px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "48px",
    },
    header: {
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    appName: {
        background: `linear-gradient(to right, ${tokens.colorBrandForeground1}, ${tokens.colorBrandForeground2})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        fontSize: "48px", // Fallback
        fontWeight: 800,
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "24px",
    },
    card: {
        height: "100%",
        backgroundColor: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderLeft: `4px solid ${tokens.colorBrandStroke1}`, // Brand accent
        ...shorthands.borderRadius(tokens.borderRadiusLarge),
        transition: "all 0.3s ease",
        ":hover": {
            transform: "translateY(-4px)",
            boxShadow: tokens.shadow16,
            ...shorthands.borderColor(tokens.colorBrandStroke1),
        },
        cursor: "pointer",
        textDecoration: "none", // For Link wrapper
    },
    cardContent: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "24px",
        gap: "12px",
    },
    iconContainer: {
        padding: "12px",
        borderRadius: "50%",
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    footer: {
        textAlign: "center",
        marginTop: "32px",
        opacity: 0.7,
    }
});

interface DashboardViewProps {
    userEmail?: string;
    appName: string;
    appVersion: string;
    projects: any[]; // Using any[] for now matching original file (was implicitly typed)
    // Passed from server for translations if we want to use them here directly, or use hooks?
    // Since this is a client component, `useTranslations` usually works if `NextIntlClientProvider` is up the tree.
    // We can assume it is.
}

import { useTranslations } from "next-intl";

export function DashboardView({ userEmail, appName, appVersion, projects }: DashboardViewProps) {
    const styles = useStyles();
    const t = useTranslations("Dashboard");

    // Helper to wrap Card in Link or Trigger
    // Note: Card is just a div styled.
    const FeatureCard = ({ title, desc, icon: Icon, href, trigger }: any) => {
        const cardContent = (
            <Card className={styles.card}>
                <div className={styles.cardContent}>
                    <div className={styles.iconContainer}>
                        <Icon fontSize={32} />
                    </div>
                    <Subtitle1 block style={{ fontWeight: "bold" }}>{title}</Subtitle1>
                    <Text block size={200} style={{ color: tokens.colorNeutralForeground2 }}>{desc}</Text>
                </div>
            </Card>
        );

        if (trigger) {
            return trigger(cardContent);
        }

        return (
            <Link href={href} passHref legacyBehavior>
                <a style={{ textDecoration: 'none' }}>{cardContent}</a>
            </Link>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.appName}>{appName}</h1>
                    <Title1 as="h2" style={{ fontWeight: 300 }}>
                        {t('welcome', { name: userEmail || "Guest" })}
                    </Title1>
                </div>

                <div className={styles.grid}>
                    <FeatureCard
                        title={t('inventory_title')}
                        desc={t('inventory_desc')}
                        icon={BoxMultipleRegular}
                        href="/inventory"
                    />

                    {/* Create Usage Dialog Card Trigger */}
                    <CreateUsageDialog
                        projects={projects}
                        trigger={
                            // We pass a function or element. The original `CreateUsageDialog` likely expects `trigger` as ReactElement.
                            // We can wrap the card in a div that acts as the trigger.
                            // But since `CreateUsageDialog` is Radix/Shadcn based currently, the trigger prop usually expects a button-like or element that accepts onClick.
                            // A Card works.
                            <div style={{ height: '100%' }}>
                                <Card className={styles.card}>
                                    <div className={styles.cardContent}>
                                        <div className={styles.iconContainer}>
                                            <ClipboardTaskRegular fontSize={32} />
                                        </div>
                                        <Subtitle1 block style={{ fontWeight: "bold" }}>{t('register_usage_title')}</Subtitle1>
                                        <Text block size={200} style={{ color: tokens.colorNeutralForeground2 }}>{t('register_usage_desc')}</Text>
                                    </div>
                                </Card>
                            </div>
                        }
                    />

                    <FeatureCard
                        title={t('usage_history_title')}
                        desc={t('usage_history_desc')}
                        icon={ClipboardTaskRegular}
                        href="/usage/history"
                    />

                    <FeatureCard
                        title={t('projects_title')}
                        desc={t('projects_desc')}
                        icon={FolderRegular}
                        href="/projects"
                    />

                    <FeatureCard
                        title={t('search_stock_title')}
                        desc={t('search_stock_desc')}
                        icon={SearchRegular}
                        href="/stock"
                    />

                    <FeatureCard
                        title={t('settings_title')}
                        desc={t('settings_desc')}
                        icon={SettingsRegular}
                        href="/settings"
                    />
                </div>

                <div className={styles.footer}>
                    <Text size={200} weight="medium" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                        {t('system_active')} • {appVersion}
                    </Text>
                </div>
            </div>
        </div>
    );
}
