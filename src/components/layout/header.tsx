import { MobileNav } from "@/components/layout/mobile-nav";

// ... existing imports ...

export function Header({ userEmail }: { userEmail?: string }) {
    // ... existing code ...

    return (
        <header className={styles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MobileNav />
                <Link href="/" className={styles.logo}>
                    {APP_CONFIG.name}
                </Link>
            </div>

            <div className={styles.nav}>
                {/* ... existing desktop nav ... */}
                <TabList
                    selectedValue={selectedValue}
                    onTabSelect={(e, data) => {
                        // ... existing logic ...
                    }}
                >
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
        </header>
    );
}
