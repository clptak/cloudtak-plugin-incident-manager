import { server } from '../../../../src/std.ts';
import type { SearchReverseWeather } from '../../../../src/types.ts';

export async function fetchWeatherSummary(
    longitude: number,
    latitude: number,
): Promise<string> {
    const { data, error: reqError } = await server.GET(
        '/api/search/reverse/{:longitude}/{:latitude}/weather',
        {
            params: {
                path: { ':longitude': longitude, ':latitude': latitude },
            },
        },
    );

    if (reqError) throw new Error(String(reqError));
    return formatWeatherSummary(data.weather);
}

export function formatPeriodStartTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

export function formatWeatherSummary(weather: SearchReverseWeather['weather']): string {
    if (!weather?.properties?.periods?.length) return '';

    const lines: string[] = [];
    const periods = weather.properties.periods.slice(0, 4);
    for (const period of periods) {
        const temp = `${period.temperature}°${period.temperatureUnit}`;
        const wind = `${period.windSpeed} ${period.windDirection}`.trim();
        const precip = period.probabilityOfPrecipitation?.value;
        const precipText = precip != null && precip > 0 ? `, ${precip}% precip` : '';
        const time = formatPeriodStartTime(period.startTime);
        const timePrefix = time ? `${time} — ` : '';
        lines.push(`${timePrefix}${period.shortForecast}, ${temp}, wind ${wind}${precipText}`);
    }

    const generator = weather.properties.forecastGenerator;
    if (generator) lines.push(`Source: ${generator}`);
    return lines.join('\n');
}
