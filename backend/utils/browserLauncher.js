const puppeteer = require('puppeteer-core');

async function launchBrowser() {
    const options = {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
        ],
        executablePath: '/usr/bin/google-chrome', // Confirmed path for Docker/Render
        headless: 'new',
        timeout: 30000
    };

    try {
        return await puppeteer.launch(options);
    } catch (error) {
        console.error('Chrome launch error:', error);
        // Try alternative Chrome path
        try {
            options.executablePath = '/usr/bin/chromium';
            return await puppeteer.launch(options);
        } catch (fallbackError) {
            console.error('Fallback launch failed:', fallbackError);
            throw error;
        }
    }
}

module.exports = { launchBrowser };
      
    

module.exports = { launchBrowser };
