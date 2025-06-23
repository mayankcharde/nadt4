// const express = require('express');
// const router = express.Router();
// let chromium = null;
// try {
//     chromium = require('chrome-aws-lambda');
// } catch (e) {
//     // chrome-aws-lambda not available locally, ignore
// }
// const path = require('path');
// const fs = require('fs').promises;
// const handlebars = require('handlebars');
// const Certificate = require('../models/Certificate');
// const UserCourse = require('../models/UserCourse'); // Import UserCourse model
// const { v4: uuidv4 } = require('uuid');
// const jwt = require('jsonwebtoken');

// // Helper function to generate certificate number
// const generateCertNumber = () => {
//     return `NADT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
// };

// const isRender = process.env.RENDER === 'true' || process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.CHROME_AWS_LAMBDA_VERSION;

// const CERT_DIR = path.join(__dirname, '..', 'generated-certificates');

// // Utility to ensure directory exists
// async function ensureCertDir() {
//     try {
//         await fs.mkdir(CERT_DIR, { recursive: true });
//     } catch (err) {
//         console.error('Failed to create certificates directory:', err);
//         throw err;
//     }
// }


// // ...existing code...
// router.get('/download/:certNumber', async (req, res) => {
//     try {
//         const certificate = await Certificate.findOne({ certificateNumber: req.params.certNumber });
//         if (!certificate) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Certificate not found'
//             });
//         }

//         // For Render deployment, certificates are stored in /tmp
//         const pdfPath = isRender ? `/tmp/${certificate.certificateNumber}.pdf` : certificate.pdfPath;

//         try {
//             await fs.access(pdfPath);
//         } catch (error) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Certificate file not found'
//             });
//         }

//         const fileBuffer = await fs.readFile(pdfPath);
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', `attachment; filename=${certificate.certificateNumber}.pdf`);
//         res.send(fileBuffer);
//     } catch (error) {
//         console.error('Error downloading certificate:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to download certificate',
//             details: error.message
//         });
//     }
// });
// // ...existing code...

// // Certificate generation endpoint
// router.post('/generate', async (req, res) => {
//     let browser = null;
//     let pdfPath = '';
//     const timeoutMs = 25000; // 25s timeout for Chrome
//     const startMem = process.memoryUsage().rss;
//     try {
//         const { name, course, date } = req.body;
        
//         // Add input validation
//         if (!name || typeof name !== 'string' || name.trim() === '') {
//             throw new Error('Valid name is required');
//         }

//         if (!course || typeof course !== 'string' || course.trim() === '') {
//             throw new Error('Valid course name is required');
//         }

//         // Get userId from JWT
//         const token = req.headers.authorization?.split(' ')[1];
//         if (!token) {
//             throw new Error('No auth token provided');
//         }

//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         const userId = decoded.userId;

//         // Verify user exists and has access to the course
//         const userCourse = await UserCourse.findOne({
//             userId: userId,
//             courseName: course,
//         });

//         if (!userCourse) {
//             throw new Error('User does not have access to this course');
//         }

//         await ensureCertDir();
//         // Generate unique certificate number
//         const certNumber = generateCertNumber();
//         pdfPath = path.join(CERT_DIR, `${certNumber}.pdf`);
        
//         // Create certificate record first to validate
//         const certificate = new Certificate({
//             userId,
//             courseName: course,
//             userName: name.trim(), // Ensure name is trimmed
//             certificateNumber: certNumber,
//             completionDate: new Date(),
//             pdfPath
//         });

//         // Validate the certificate document
//         const validationError = certificate.validateSync();
//         if (validationError) {
//             // Return validation error as 400
//             return res.status(400).json({
//                 success: false,
//                 error: 'Certificate validation failed',
//                 details: validationError.message
//             });
//         }

//         // Save the certificate
//         await certificate.save();

//         // Create PDF directory if it doesn't exist
//         const pdfDir = path.join(__dirname, '..', 'generated-certificates');
//         await fs.mkdir(pdfDir, { recursive: true });

//         // Read template
//         const templatePath = path.join(__dirname, '..', 'templates', 'certificate.html');
//         const templateContent = await fs.readFile(templatePath, 'utf-8');

//         // Get template background path
//         const templateBgPath = path.join(__dirname, '..', 'assets', 'certTemplate.png');
        
//         // Check if template background exists
//         try {
//             await fs.access(templateBgPath);
//         } catch (error) {
//             throw new Error('Certificate template background not found');
//         }

//         // Convert template background to data URL
//         const backgroundImage = await fs.readFile(templateBgPath);
//         const backgroundDataUrl = `data:image/png;base64,${backgroundImage.toString('base64')}`;

//         // Compile template with background as data URL
//         const template = handlebars.compile(templateContent);
//         const html = template({
//             name,
//             course,
//             date,
//             certNumber,
//             templatePath: backgroundDataUrl
//         });

//         // Use system Chromium for Render.com and similar environments
//         const puppeteer = require('puppeteer-core');
//         browser = await puppeteer.launch({
//             args: ['--no-sandbox', '--disable-setuid-sandbox'],
//             executablePath: '/usr/bin/chromium-browser',
//             headless: 'new',
//             defaultViewport: { width: 1120, height: 792 },
//             timeout: timeoutMs
//         });

//         const page = await browser.newPage();
//         await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });

//         // Always use /tmp for ephemeral storage on Render
//         const renderPath = `/tmp/${certNumber}.pdf`;
//         await page.pdf({
//             path: renderPath,
//             width: '1120px',
//             height: '792px',
//             printBackground: true,
//             preferCSSPageSize: true,
//             timeout: timeoutMs
//         });

//         // Update certificate record with the correct path for the deployment environment
//         certificate.pdfPath = isRender ? renderPath : pdfPath;
//         await certificate.save();

//         // Clean up browser
//         await browser.close();
//         browser = null;

//         // Wait for file to exist before sending (stateless: send directly)
//         await fs.access(pdfPath);

//         // Send PDF directly in response (stateless best practice)
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', `attachment; filename=${certNumber}.pdf`);
//         const fileBuffer = await fs.readFile(pdfPath);
//         res.send(fileBuffer);

//         // Optionally: delete the file after sending if you want to keep storage clean
//         // await fs.unlink(pdfPath);

//         // Memory monitoring (log if > 350MB)
//         const endMem = process.memoryUsage().rss;
//         if (endMem - startMem > 350 * 1024 * 1024) {
//             console.warn('High memory usage after PDF generation:', (endMem / 1024 / 1024).toFixed(1), 'MB');
//         }
//     } catch (error) {
//         if (browser) try { await browser.close(); } catch {}
//         console.error('Certificate generation error:', error);
//         if (error.message && error.message.includes('Chrome launch timeout')) {
//             return res.status(504).json({ success: false, error: 'PDF generation timed out' });
//         }
//         res.status(500).json({ 
//             success: false, 
//             error: 'Certificate generation failed',
//             details: error.message 
//         });
//     }
// });

// // Add this new route before module.exports
// router.get('/user/:userId', async (req, res) => {
//     try {
//         const certificates = await Certificate.find({ userId: req.params.userId })
//             .sort({ createdAt: -1 }); // Most recent first

//         res.json({
//             success: true,
//             certificates
//         });
//     } catch (error) {
//         // Fixed typo: removed stray text and corrected error log
//         console.error('Error fetching user certificates:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to fetch certificates',
//             details: error.message
//         });
//     }
// });

// // Download certificate by certificate number
// router.get('/download/:certNumber', async (req, res) => {
//     try {
//         const certificate = await Certificate.findOne({ certificateNumber: req.params.certNumber });
//         if (!certificate) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Certificate not found'
//             });
//         }

//         // For Render deployment, certificates are stored in /tmp
//         const pdfPath = isRender ? `/tmp/${certificate.certificateNumber}.pdf` : certificate.pdfPath;

//         try {
//             await fs.access(pdfPath);
//         } catch (error) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Certificate file not found'
//             });
//         }

//         const fileBuffer = await fs.readFile(pdfPath);
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', `attachment; filename=${certificate.certificateNumber}.pdf`);
//         res.send(fileBuffer);
//     } catch (error) {
//         console.error('Error downloading certificate:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to download certificate',
//             details: error.message
//         });
//     }
// });

// module.exports = router;









const express = require('express');
const router = express.Router();
let chromium = null;
try {
    chromium = require('chrome-aws-lambda');
} catch (e) {
    // chrome-aws-lambda not available locally, ignore
}
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const Certificate = require('../models/Certificate');
const UserCourse = require('../models/UserCourse'); // Import UserCourse model
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { launchBrowser } = require('../utils/browserLauncher');

// Helper function to generate certificate number
const generateCertNumber = () => {
    return `NADT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
};

const isRender = process.env.RENDER === 'true' || process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.CHROME_AWS_LAMBDA_VERSION;

const CERT_DIR = path.join(__dirname, '..', 'generated-certificates');

// Utility to ensure directory exists
async function ensureCertDir() {
    try {
        await fs.mkdir(CERT_DIR, { recursive: true });
    } catch (err) {
        console.error('Failed to create certificates directory:', err);
        throw err;
    }
}


// ...existing code...
router.get('/download/:certNumber', async (req, res) => {
    try {
        const certificate = await Certificate.findOne({ certificateNumber: req.params.certNumber });
        if (!certificate) {
            return res.status(404).json({
                success: false,
                error: 'Certificate not found'
            });
        }

        // For Render deployment, certificates are stored in /tmp
        const pdfPath = isRender ? `/tmp/${certificate.certificateNumber}.pdf` : certificate.pdfPath;

        try {
            await fs.access(pdfPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Certificate file not found'
            });
        }

        const fileBuffer = await fs.readFile(pdfPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${certificate.certificateNumber}.pdf`);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Error downloading certificate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download certificate',
            details: error.message
        });
    }
});
// ...existing code...

// Certificate generation endpoint
router.post('/generate', async (req, res) => {
    let browser = null;
    try {
        // Fallback/defaults for missing data
        const name = (req.body?.name || 'Participant').toString().trim();
        const course = (req.body?.course || 'Course').toString().trim();
        const date = req.body?.date || new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Validate input
        if (!name || !course) {
            return res.status(400).json({
                success: false,
                error: 'Name and course are required'
            });
        }

        // Auth check
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, error: 'No auth token provided' });
        }
        let userId;
        try {
            const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch (err) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }

        // Check course access
        const userCourse = await UserCourse.findOne({ userId, courseName: course });
        if (!userCourse) {
            return res.status(403).json({ success: false, error: 'User does not have access to this course' });
        }

        // Prepare certificate number and template
        const certNumber = `NADT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase();
        const path = require('path');
        const fs = require('fs').promises;
        const CERT_DIR = path.join(__dirname, '..', 'generated-certificates');
        await fs.mkdir(CERT_DIR, { recursive: true });
        const templatePath = path.join(__dirname, '..', 'templates', 'certificate.html');
        let templateContent;
        try {
            templateContent = await fs.readFile(templatePath, 'utf-8');
        } catch {
            templateContent = `<html><body><h1>Certificate</h1><p>Name: ${name}</p><p>Course: ${course}</p><p>Date: ${date}</p></body></html>`;
        }
        // Background image as data URL (optional)
        let backgroundDataUrl = '';
        try {
            const bgPath = path.join(__dirname, '..', 'assets', 'certTemplate.png');
            const bg = await fs.readFile(bgPath);
            backgroundDataUrl = `data:image/png;base64,${bg.toString('base64')}`;
        } catch {}

        // Compile HTML
        const handlebars = require('handlebars');
        const html = handlebars.compile(templateContent)({
            name, course, date, certNumber, templatePath: backgroundDataUrl
        });

        // Puppeteer setup (use browserLauncher util if you have it, else direct)
        const puppeteer = require('puppeteer-core');
        const executablePath = process.env.CHROME_BIN || '/usr/bin/chromium-browser';
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath,
            headless: true,
            timeout: 20000
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 15000 });

        // Save PDF to /tmp on Render, else to CERT_DIR
        const isRender = process.env.RENDER === 'true' || process.env.AWS_LAMBDA_FUNCTION_VERSION;
        const pdfPath = isRender
            ? `/tmp/${certNumber}.pdf`
            : path.join(CERT_DIR, `${certNumber}.pdf`);

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' }
        });

        // Create and save certificate record in database
        const certificate = new Certificate({
            userId,
            courseName: course,
            userName: name,
            certificateNumber: certNumber,
            completionDate: new Date(),
            pdfPath: pdfPath // Save the correct path based on environment
        });
        
        await certificate.save();
        console.log(`Certificate saved with ID: ${certificate._id}, Path: ${pdfPath}`);

        await browser.close();
        browser = null;

        // Send PDF as download
        const fileBuffer = await fs.readFile(pdfPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=certificate.pdf`);
        res.send(fileBuffer);

        // Don't delete the file on Render as we need it for future downloads
        // if (isRender) {
        //     try { await fs.unlink(pdfPath); } catch {}
        // }
    } catch (error) {
        if (browser) try { await browser.close(); } catch {}
        console.error('Certificate generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Certificate generation failed',
            details: error.message,
            stack: error.stack
        });
    }
});

// Add this new route before module.exports
router.get('/user/:userId', async (req, res) => {
    try {
        const certificates = await Certificate.find({ userId: req.params.userId })
            .sort({ createdAt: -1 }); // Most recent first

        res.json({
            success: true,
            certificates
        });
    } catch (error) {
        // Fixed typo: removed stray text and corrected error log
        console.error('Error fetching user certificates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch certificates',
            details: error.message
        });
    }
});

// Download certificate by certificate number
router.get('/download/:certNumber', async (req, res) => {
    try {
        const certificate = await Certificate.findOne({ certificateNumber: req.params.certNumber });
        if (!certificate) {
            return res.status(404).json({
                success: false,
                error: 'Certificate not found'
            });
        }

        // For Render deployment, certificates are stored in /tmp
        const pdfPath = isRender ? `/tmp/${certificate.certificateNumber}.pdf` : certificate.pdfPath;

        try {
            await fs.access(pdfPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Certificate file not found'
            });
        }

        const fileBuffer = await fs.readFile(pdfPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${certificate.certificateNumber}.pdf`);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Error downloading certificate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download certificate',
            details: error.message
        });
    }
});

module.exports = router;




