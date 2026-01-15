"use client";

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import {
    Menu,
    MenuTrigger,
    MenuList,
    MenuItem,
    MenuPopover,
    Button,
} from "@fluentui/react-components";
import { LocalLanguageRegular } from "@fluentui/react-icons";

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const toggleLanguage = (newLocale: string) => {
        const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
        router.push(newPathname || `/${newLocale}`);
    };

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Button appearance="subtle" icon={<LocalLanguageRegular />} aria-label="Switch language">
                    <span style={{ display: 'none' }}>Switch language</span>
                </Button>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    <MenuItem onClick={() => toggleLanguage('en')}>
                        English
                    </MenuItem>
                    <MenuItem onClick={() => toggleLanguage('lv')}>
                        Latviešu
                    </MenuItem>
                </MenuList>
            </MenuPopover>
        </Menu>
    );
}
