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
    const lang = req.query.lang || 'tc';
    
    const validTypes = ['rhrread', 'warnsum', 'swt', 'fnd', 'flw', 'warningInfo', 'radar', 'radar-img'];
    
    if (!validTypes.includes(dataType)) {
        return res.status(400).json({ error: 'Invalid dataType' });
    }

    if (dataType === 'radar-img') {
        const imgPath = req.query.path || '';
        if (!imgPath || !/^[a-zA-Z0-9_\/.-]+$/.test(imgPath)) {
            return res.status(400).json({ error: 'Invalid image path' });
        }
        try {
            const targetUrl = `https://www.hko.gov.hk/wxinfo/radars/${imgPath}`;
            const imgResp = await fetch(targetUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (!imgResp.ok) {
                return res.status(imgResp.status).end();
            }
            const arrayBuffer = await imgResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            res.setHeader('Content-Type', imgResp.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.status(200).send(buffer);
        } catch (err) {
            return res.status(500).json({ error: 'Failed to proxy radar image' });
        }
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let hkoUrl;
        if (dataType === 'radar') {
            hkoUrl = 'https://www.hko.gov.hk/wxinfo/radars/temp_json/nradar_img.json';
        } else {
            hkoUrl = `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=${dataType}&lang=${encodeURIComponent(lang)}`;
        }
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