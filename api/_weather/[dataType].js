export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const { dataType } = req.query;
    const lang = req.query.lang || 'en';
    
    const validTypes = ['rhrread', 'warnsum', 'swt', 'fnd', 'flw', 'warningInfo'];
    
    if (!validTypes.includes(dataType)) {
        return res.status(400).json({ error: 'Invalid dataType' });
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const hkoUrl = `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=${dataType}&lang=${encodeURIComponent(lang)}`;
        const response = await fetch(hkoUrl, {
            headers: {
                // Some gateways need an explicit accept for JSON.
                'Accept': 'application/json',
            },
            signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`HKO API error: ${response.status} ${text}`);
        }

        const raw = await response.text();
        let data = null;
        try {
            data = JSON.parse(raw);
        } catch (parseErr) {
            const contentType = response.headers.get('content-type') || '';
            throw new Error(`HKO response parse failed (content-type=${contentType}): ${String(parseErr.message || parseErr)}`);
        }

        
        // Cache for 5 minutes
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
}