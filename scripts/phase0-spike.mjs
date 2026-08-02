#!/usr/bin/env node
/**
 * Phase 0 spike — validate DataSync/Channel behavior against a live CloudTAK + TAK Server.
 * See docs/multi-op-datasync-architecture.md §5 Phase 0.
 *
 * Verifies (with pass/fail output):
 *   T1  Manager creates a SWORN-only mission
 *   T2  Volunteer cannot see it in the mission list (channel invisibility)
 *   T3  Manager creates a dual-channel mission [SWORN, SARVOL]
 *   T4  Volunteer CAN see the dual mission
 *   T5  Volunteer subscribes + can write (mission log) as default MISSION_SUBSCRIBER
 *   T6  Manager flips volunteer to MISSION_READONLY_SUBSCRIBER → volunteer write now fails
 *   T7  Manager PATCHes dual mission groups → [SWORN] only → volunteer loses visibility
 *   T8  Cleanup (delete test missions + volunteer overlay)
 *
 * Usage:
 *   CLOUDTAK_URL=https://dev.example.com \
 *   MANAGER_USER=manager@x.com MANAGER_PASS=... \
 *   VOLUNTEER_USER=vol@x.com VOLUNTEER_PASS=... \
 *   SWORN_CHANNEL=SWORN-TEST SARVOL_CHANNEL=SARVOL-TEST \
 *   node scripts/phase0-spike.mjs
 *
 * Self-signed dev TLS: prepend NODE_TLS_REJECT_UNAUTHORIZED=0
 * Add KEEP=1 to skip cleanup (leave test missions for manual inspection).
 */

const cfg = {
    url: required('CLOUDTAK_URL').replace(/\/$/, ''),
    manager: { user: required('MANAGER_USER'), pass: required('MANAGER_PASS') },
    volunteer: { user: required('VOLUNTEER_USER'), pass: required('VOLUNTEER_PASS') },
    sworn: process.env.SWORN_CHANNEL || 'SWORN-TEST',
    sarvol: process.env.SARVOL_CHANNEL || 'SARVOL-TEST',
    keep: process.env.KEEP === '1',
};

function required(name) {
    const v = process.env[name];
    if (!v) { console.error(`Missing env var: ${name}`); process.exit(2); }
    return v;
}

const ts = Date.now().toString(36).toUpperCase();
const SWORN_MISSION = `ZZTEST-SWORN-${ts}`;
const DUAL_MISSION = `ZZTEST-DUAL-${ts}`;

const results = [];
function record(id, desc, pass, detail = '') {
    results.push({ id, desc, pass, detail });
    console.log(`${pass ? '  PASS' : '! FAIL'}  ${id}  ${desc}${detail ? ` — ${detail}` : ''}`);
}

async function api(token, method, path, body, extraHeaders = {}) {
    const res = await fetch(`${cfg.url}/api${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...extraHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, ok: res.ok, json };
}

async function login(who) {
    const res = await fetch(`${cfg.url}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: who.user, password: who.pass }),
    });
    if (!res.ok) throw new Error(`Login failed for ${who.user}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    return { token: body.token, email: body.email };
}

function missionNames(listJson) {
    const data = listJson?.data ?? listJson?.items ?? [];
    return (Array.isArray(data) ? data : []).map((m) => m.name);
}

async function main() {
    console.log(`\nPhase 0 spike against ${cfg.url}`);
    console.log(`Channels: sworn=${cfg.sworn} sarvol=${cfg.sarvol}\n`);

    // ── Preflight: logins + channel membership ──────────────────────────────
    const mgr = await login(cfg.manager);
    const vol = await login(cfg.volunteer);
    console.log(`Logged in: manager=${mgr.email} volunteer=${vol.email}`);

    for (const [label, who] of [['manager', mgr], ['volunteer', vol]]) {
        const g = await api(who.token, 'GET', '/marti/group?useCache=true');
        const names = (g.json?.data ?? []).filter((x) => x.active !== false).map((x) => x.name);
        console.log(`  ${label} active channels: ${JSON.stringify([...new Set(names)])}`);
    }
    console.log('  ^ verify manager shows BOTH channels, volunteer shows sarvol only.\n');

    // ── T1: Sworn-only mission ──────────────────────────────────────────────
    const t1 = await api(mgr.token, 'POST', '/marti/mission', {
        name: SWORN_MISSION,
        group: [cfg.sworn],
        description: 'Phase0 spike: sworn-only',
    });
    record('T1', 'Manager creates SWORN-only mission', t1.ok, t1.ok ? SWORN_MISSION : JSON.stringify(t1.json));

    // ── T2: invisible to volunteer ──────────────────────────────────────────
    const volList1 = await api(vol.token, 'GET', '/marti/mission');
    const mgrList1 = await api(mgr.token, 'GET', '/marti/mission');
    const volSees = missionNames(volList1.json).includes(SWORN_MISSION);
    const mgrSees = missionNames(mgrList1.json).includes(SWORN_MISSION);
    record('T2', 'SWORN-only mission invisible to volunteer, visible to manager', !volSees && mgrSees,
        `volunteerSees=${volSees} managerSees=${mgrSees}`);

    // ── T3: dual-channel mission ────────────────────────────────────────────
    const t3 = await api(mgr.token, 'POST', '/marti/mission', {
        name: DUAL_MISSION,
        group: [cfg.sworn, cfg.sarvol],
        description: 'Phase0 spike: dual-channel',
    });
    const dualGuid = t3.json?.guid;
    record('T3', 'Manager creates dual-channel mission', t3.ok, t3.ok ? `${DUAL_MISSION} guid=${dualGuid}` : JSON.stringify(t3.json));

    // ── T4: visible to volunteer ────────────────────────────────────────────
    const volList2 = await api(vol.token, 'GET', '/marti/mission');
    record('T4', 'Dual mission visible to volunteer', missionNames(volList2.json).includes(DUAL_MISSION));

    // ── T5: volunteer subscribes + writes ───────────────────────────────────
    let overlayId = null;
    const sub = await api(vol.token, 'POST', '/profile/overlay', {
        name: DUAL_MISSION,
        url: `/mission/${encodeURIComponent(dualGuid ?? DUAL_MISSION)}`,
        type: 'geojson',
        mode: 'mission',
        mode_id: dualGuid ?? DUAL_MISSION,
    });
    overlayId = sub.json?.id ?? null;
    const write1 = await api(vol.token, 'POST', `/marti/missions/${encodeURIComponent(DUAL_MISSION)}/log`, {
        content: 'Phase0 spike: volunteer write as SUBSCRIBER',
    });
    record('T5', 'Volunteer subscribe + write log (default role)', sub.ok && write1.ok,
        `subscribe=${sub.status} write=${write1.status}`);

    // ── T6: readonly flip ───────────────────────────────────────────────────
    const roles = await api(mgr.token, 'GET', `/marti/missions/${encodeURIComponent(DUAL_MISSION)}/subscriptions/roles`);
    const subs = roles.json?.data ?? [];
    console.log(`  subscriptions/roles: ${JSON.stringify(subs, null, 2).slice(0, 800)}`);
    const volSub = subs.find((s) =>
        (s.username ?? '').toLowerCase().includes(vol.email.toLowerCase()) ||
        (s.clientUid ?? '').toLowerCase().includes(vol.email.toLowerCase()));
    let t6pass = false; let t6detail = 'volunteer subscription not found in roles list';
    if (volSub) {
        const flip = await api(mgr.token, 'PUT', `/marti/missions/${encodeURIComponent(DUAL_MISSION)}/role`, {
            clientUid: volSub.clientUid,
            username: volSub.username,
            role: 'MISSION_READONLY_SUBSCRIBER',
        });
        const write2 = await api(vol.token, 'POST', `/marti/missions/${encodeURIComponent(DUAL_MISSION)}/log`, {
            content: 'Phase0 spike: volunteer write as READONLY (should fail)',
        });
        t6pass = flip.ok && !write2.ok;
        t6detail = `flip=${flip.status} writeAfterFlip=${write2.status} (expect flip 200, write 4xx)`;
    }
    record('T6', 'Readonly flip blocks volunteer writes', t6pass, t6detail);

    // ── T7: group change removes visibility ─────────────────────────────────
    const patch = await api(mgr.token, 'PATCH', `/marti/missions/${encodeURIComponent(DUAL_MISSION)}`, {
        groups: [cfg.sworn],
    });
    const volList3 = await api(vol.token, 'GET', '/marti/mission');
    const stillSees = missionNames(volList3.json).includes(DUAL_MISSION);
    record('T7', 'PATCH groups → sworn-only removes volunteer visibility', patch.ok && !stillSees,
        `patch=${patch.status} volunteerStillSees=${stillSees}`);

    // ── T8: cleanup ─────────────────────────────────────────────────────────
    if (cfg.keep) {
        record('T8', 'Cleanup skipped (KEEP=1)', true, `left: ${SWORN_MISSION}, ${DUAL_MISSION}`);
    } else {
        if (overlayId !== null) {
            await api(vol.token, 'DELETE', `/profile/overlay?id=${overlayId}`);
        }
        const d1 = await api(mgr.token, 'DELETE', `/marti/missions/${encodeURIComponent(SWORN_MISSION)}`);
        const d2 = await api(mgr.token, 'DELETE', `/marti/missions/${encodeURIComponent(DUAL_MISSION)}`);
        record('T8', 'Cleanup (delete test missions)', d1.ok && d2.ok, `sworn=${d1.status} dual=${d2.status}`);
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    const failed = results.filter((r) => !r.pass);
    console.log(`\n${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILURE(S)`} — ${results.length} checks`);
    if (failed.length) {
        console.log('Failed: ' + failed.map((r) => r.id).join(', '));
        console.log('Do NOT proceed to Phase 1 until failures are understood (see architecture doc §5 Phase 0).');
        process.exit(1);
    }
}

main().catch((err) => { console.error('\nSpike aborted:', err.message); process.exit(1); });
