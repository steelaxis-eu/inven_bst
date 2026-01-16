'use client'

import * as React from 'react'
import {
    OverlayDrawer,
    Button,
    makeStyles,
    tokens,
    DrawerHeader,
    DrawerHeaderTitle,
    DrawerBody,
} from "@fluentui/react-components";
import { NavigationRegular, DismissRegular } from "@fluentui/react-icons";
import { Link } from "@/components/navigation"; // Assuming we might want a centralized link or generic next/link
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const useStyles = makeStyles({
    root: {
        display: 'none',
        '@media (max-width: 768px)': {
            display: 'block',
        },
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: '16px',
    },
    navLink: {
        textDecoration: 'none',
        color: tokens.colorNeutralForeground1,
        fontSize: '16px',
        padding: '12px 16px',
        borderRadius: tokens.borderRadiusMedium,
        transition: 'background-color 0.2s',
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    activeLink: {
        backgroundColor: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground1,
        fontWeight: 'bold',
    },
});

export function MobileNav() {
    const styles = useStyles();
    const [isOpen, setIsOpen] = React.useState(false);
    const pathname = usePathname();
    const t = useTranslations("Navigation");

    // Close drawer on route change
    React.useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    const links = [
        { href: "/", label: t("dashboard") },
        { href: "/stock", label: t("stock") },
        { href: "/inventory", label: t("inventory") },
        { href: "/usage/history", label: t("history") },
        { href: "/projects", label: t("projects") },
        { href: "/customers", label: t("customers") },
        { href: "/settings", label: t("settings") },
    ];

    return (
        <div className={styles.root}>
            <Button
                appearance="subtle"
                icon={<NavigationRegular />}
                onClick={() => setIsOpen(true)}
                aria-label="Open menu"
            />

            <OverlayDrawer
                open={isOpen}
                onOpenChange={(_, { open }) => setIsOpen(open)}
                position="start"
            >
                <DrawerHeader>
                    <DrawerHeaderTitle
                        action={
                            <Button
                                appearance="subtle"
                                aria-label="Close"
                                icon={<DismissRegular />}
                                onClick={() => setIsOpen(false)}
                            />
                        }
                    >
                        Menu
                    </DrawerHeaderTitle>
                </DrawerHeader>

                <DrawerBody>
                    <nav className={styles.nav}>
                        {links.map((link) => {
                            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                            return (
                                <NextLink
                                    key={link.href}
                                    href={link.href}
                                    className={`${styles.navLink} ${isActive ? styles.activeLink : ''}`}
                                >
                                    {link.label}
                                </NextLink>
                            );
                        })}
                    </nav>
                </DrawerBody>
            </OverlayDrawer>
        </div>
    );
}
