/**
 * Multi-format coordinate parser, ported from ccsosar-tak Initial_Response.html.
 * Supports: MPS Hexagon (lon,lat), decimal degrees, DMS, decimal minutes (DM).
 * Returns decimal degrees { lat, lng } or null if unparseable.
 */
export interface LatLng {
    lat: number;
    lng: number;
}

export function parseCoordinates(input: string): LatLng | null {
    if (!input || !input.trim()) return null;
    const s = input.trim();

    // MPS: (-ddd:dd:ss.ssss,dd:dd:ss.ssss) — lon,lat order
    const mps = s.match(/\((-?\d+):(\d+):(\d+\.?\d*)\s*,\s*(\d+):(\d+):(\d+\.?\d*)\)/);
    if (mps) {
        const lonDeg = parseInt(mps[1], 10), lonMin = parseInt(mps[2], 10), lonSec = parseFloat(mps[3]);
        const latDeg = parseInt(mps[4], 10), latMin = parseInt(mps[5], 10), latSec = parseFloat(mps[6]);
        const lng = (Math.abs(lonDeg) + lonMin / 60 + lonSec / 3600) * (lonDeg < 0 ? -1 : 1);
        const lat = latDeg + latMin / 60 + latSec / 3600;
        return { lat, lng };
    }

    // Decimal degrees: 37.02217,-112.02356 or 37.02217 -112.02356
    const dd = s.match(/(-?\d+\.\d+)\s*[,;\s|]\s*(-?\d+\.\d+)/);
    if (dd) {
        const a = parseFloat(dd[1]), b = parseFloat(dd[2]);
        let lat: number, lng: number;
        if (Math.abs(a) > 90 || Math.abs(b) > 90) {
            lat = Math.abs(a) <= 90 ? a : b;
            lng = Math.abs(a) > 90 ? a : b;
        } else if (a >= 0 && b < 0) {
            lat = a; lng = b;
        } else if (b >= 0 && a < 0) {
            lat = b; lng = a;
        } else {
            lat = a; lng = b;
        }
        return { lat, lng };
    }

    // DMS: deg min sec deg min sec — e.g. 35 11 10 -111 38 25
    const dms = s.match(/(\d+)\s*[\s\W]\s*(\d+)\s*[\s\W]\s*(\d+\.?\d*)\s+(-?\d+)\s*[\s\W]\s*(\d+)\s*[\s\W]\s*(\d+\.?\d*)/);
    if (dms) {
        const latDeg = parseInt(dms[1], 10), latMin = parseInt(dms[2], 10), latSec = parseFloat(dms[3]);
        const lonDeg = parseInt(dms[4], 10), lonMin = parseInt(dms[5], 10), lonSec = parseFloat(dms[6]);
        const lat = latDeg + latMin / 60 + latSec / 3600;
        const lng = (Math.abs(lonDeg) + lonMin / 60 + lonSec / 3600) * (lonDeg < 0 ? -1 : 1);
        return { lat, lng };
    }

    // Decimal minutes (DM): deg min.mm deg min.mm — e.g. 35 11.17 -111 38.42
    const dm = s.match(/(\d+)\s*[\s\W]\s*(\d+\.\d+)\s+(-?\d+)\s*[\s\W]\s*(\d+\.\d+)/);
    if (dm) {
        const latDeg = parseInt(dm[1], 10), latMin = parseFloat(dm[2]);
        const lonDeg = parseInt(dm[3], 10), lonMin = parseFloat(dm[4]);
        const lat = latDeg + latMin / 60;
        const lng = (Math.abs(lonDeg) + lonMin / 60) * (lonDeg < 0 ? -1 : 1);
        return { lat, lng };
    }

    return null;
}

/** Build the mission name the way ccsosar did: activity_date_incident[_subject][_location]. */
export function buildMissionName(opts: {
    activityNumber?: string;
    date?: string;
    incidentType?: string;
    subjectType?: string;
    locationInfo?: string;
}): string {
    const activity = (opts.activityNumber || '').trim();
    const date = opts.date || new Date().toISOString().slice(0, 10);
    const incident = opts.incidentType || 'mission';
    const subject = opts.subjectType || '';
    let location = (opts.locationInfo || '').trim();
    if (location) location = location.replace(/\s+/g, '_').slice(0, 80);

    const parts = [activity || 'mission', date, incident];
    if (subject) parts.push(subject);
    if (location) parts.push(location);
    return parts.join('_').replace(/[^a-z0-9_.-]/gi, '_');
}
