import { computed } from 'vue';
import { getRuntimeToken } from '../../../../src/std.ts';
import { createWisarClient, type WisarClient } from '../lib/wisar.ts';
import { usePluginSettings } from './usePluginSettings.ts';

/** A WiSAR client for `baseUrl`, sending this CloudTAK session's token. */
export function wisarClientFor(baseUrl: string): WisarClient {
    return createWisarClient({ baseUrl, getToken: getRuntimeToken });
}

/** The WiSAR client for the server chosen in Settings (or the branch default). */
export function useWisar() {
    const { wisarBaseUrl } = usePluginSettings();
    const client = computed(() => wisarClientFor(wisarBaseUrl.value));
    return { baseUrl: wisarBaseUrl, client };
}
