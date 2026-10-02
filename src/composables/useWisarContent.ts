import { ref, watch, type Ref } from 'vue';
import type { Content, ContentId } from '../lib/wisar.ts';
import { cssVariableStyle, sanitizeWisarHtml } from '../lib/wisarContent.ts';
import { useWisar } from './useWisar.ts';

export interface SafeContent {
    title: string;
    /** Sanitized HTML, safe for v-html. */
    html: string;
    /** CSS custom properties the fragment uses, for :style on its container. */
    style: Record<string, string>;
}

/** Per-session cache, keyed by WiSAR address and section, so modals open instantly the second time. */
const cache = new Map<string, Promise<SafeContent>>();

function toSafe(c: Content): SafeContent {
    return { title: c.title, html: sanitizeWisarHtml(c.html), style: cssVariableStyle(c.css_variables) };
}

/** Load one WiSAR reference section whenever `id` is set. */
export function useWisarContent(id: Ref<ContentId | null>) {
    const { client, baseUrl } = useWisar();
    const content = ref<SafeContent | null>(null);
    const loading = ref(false);
    const error = ref('');

    async function load(next: ContentId | null): Promise<void> {
        content.value = null;
        error.value = '';
        if (!next) return;
        const key = `${baseUrl.value}|${next}`;
        let pending = cache.get(key);
        if (!pending) {
            pending = client.value.content(next).then(toSafe);
            cache.set(key, pending);
            pending.catch(() => cache.delete(key)); // retry next time
        }
        loading.value = true;
        try {
            const result = await pending;
            if (id.value === next) content.value = result;
        } catch (err) {
            if (id.value === next) error.value = err instanceof Error ? err.message : String(err);
        } finally {
            if (id.value === next) loading.value = false;
        }
    }

    watch(id, (next) => { void load(next); }, { immediate: true });

    return { content, loading, error };
}
