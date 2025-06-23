const puppeteer = require('puppeteer-core');

async function launchBrowser() {
    const executablePaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
    ];

    for (const executablePath of executablePaths) {
        try {
            return await puppeteer.launch({
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--single-process'
                ],
                executablePath,
                headless: 'new',
                timeout: 30000
            });
        } catch (error) {
            console.error(`Failed to launch with ${executablePath}:`, error.message);
            continue;
        }
    }
    
    throw new Error('Failed to launch browser with any available Chrome/Chromium installation');
}

module.exports = { launchBrowser };
    

module.exports = { launchBrowser };
