"use client"

import * as React from "react"
import { WeatherMoonRegular, WeatherSunnyRegular, LaptopRegular } from "@fluentui/react-icons"
import { useTheme } from "next-themes"
import {
    Menu,
    MenuTrigger,
    MenuList,
    MenuItem,
    MenuPopover,
    Button,
} from "@fluentui/react-components"

export function ModeToggle() {
    const { setTheme, theme } = useTheme()

    const icon = theme === 'dark' ? <WeatherMoonRegular /> : <WeatherSunnyRegular />

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Button appearance="subtle" icon={icon} aria-label="Toggle theme">
                    <span style={{ display: 'none' }}>Toggle theme</span>
                </Button>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    <MenuItem icon={<WeatherSunnyRegular />} onClick={() => setTheme("light")}>
                        Light
                    </MenuItem>
                    <MenuItem icon={<WeatherMoonRegular />} onClick={() => setTheme("dark")}>
                        Dark
                    </MenuItem>
                    <MenuItem icon={<LaptopRegular />} onClick={() => setTheme("system")}>
                        System
                    </MenuItem>
                </MenuList>
            </MenuPopover>
        </Menu>
    )
}
