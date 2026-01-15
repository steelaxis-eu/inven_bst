'use client';

import React, { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { createDOMRenderer, RendererProvider, renderToStyleElements } from '@fluentui/react-components';

export default function StyledComponentsRegistry({ children }: { children: React.ReactNode }) {
    const [renderer] = useState(() => createDOMRenderer());

    useServerInsertedHTML(() => {
        return <>{renderToStyleElements(renderer)}</>;
    });

    return <RendererProvider renderer={renderer}>{children}</RendererProvider>;
}
