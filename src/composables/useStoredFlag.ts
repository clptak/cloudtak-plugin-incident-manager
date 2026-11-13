import { ref, watch, type Ref } from 'vue';

/**
 * A checkbox remembered in this browser. Defaults to on; storage that is
 * blocked or cleared just falls back to the default.
 */
export function useStoredFlag(key: string, fallback = true): Ref<boolean> {
    let initial = fallback;
    try {
        const saved = localStorage.getItem(key);
        if (saved !== null) initial = saved !== '0';
    } catch { /* use the default */ }
    const flag = ref(initial);
    watch(flag, (on) => {
        try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* not remembered */ }
    });
    return flag;
}
