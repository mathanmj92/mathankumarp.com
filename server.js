// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// --- Configure Multer for File Uploads ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'assets', 'uploads');
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch(err => {
        console.error("Error creating upload directory:", err);
        cb(err, null);
      });
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common types for images, documents, PDFs
    if (file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'text/plain' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type.'));
    }
  }
});

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Serve Static Files ---
app.use(express.static(path.join(__dirname)));

// --- Helper Functions ---
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log('Data file not found, creating default.');
            const defaultData = {
                name: "Dr. P. Mathan Kumar",
                description: "Academic Researcher",
                profileImage: "assets/uploads/profile.jpg",
                homeBackgroundImage: "",
                education: [],
                experience: [],
                publications: [],
                gallery: [],
                posts: [],
                resources: [],
                collaboratorsMentors: [], // Matches admin.html form ID 'collaboratorMentorForm'
                metrics: { hIndex: 0, totalCitations: 0, i10Index: 0 },
                researchAreas: [],
                socialLinks: []
            };
            await writeData(defaultData);
            return defaultData;
        } else {
            console.error("Error reading data file:", err);
            throw err;
        }
    }
}

async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- API Routes ---

// GET /api/data - Fetch all data
app.get('/api/data', async (req, res) => {
    try {
        const data = await readData();
        res.json({ success: true, data }); // Wrap in success/data structure
    } catch (err) {
        console.error('Error reading ', err);
        res.status(500).json({ success: false, error: 'Failed to load data' });
    }
});

// --- Profile Endpoints ---

// PUT /api/profile/info - Update general profile info (name, description)
app.put('/api/profile/info', async (req, res) => {
    try {
        const data = await readData();
        const { name, description } = req.body;
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        await writeData(data);
        res.json({ success: true, message: 'Profile information updated successfully' });
    } catch (err) {
        console.error('Error updating profile info:', err);
        res.status(500).json({ success: false, error: 'Failed to update profile information' });
    }
});

// POST /api/profile - Upload profile image (specific endpoint for admin.html)
// This endpoint uses Multer to handle the file upload for profile images
app.post('/api/profile', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded or file type not allowed.' });
        }
        const relativePath = path.join('assets', 'uploads', req.file.filename).replace(/\\/g, '/');

        const data = await readData();
        data.profileImage = relativePath; // Update profileImage path
        await writeData(data);

        res.json({
            success: true,
            message: 'Profile image uploaded successfully',
            filePath: relativePath
        });
    } catch (err) {
        console.error('Error uploading profile image:', err);
        res.status(500).json({ success: false, error: 'Failed to upload profile image' });
    }
});

// POST /api/home-background - Upload home background image (specific endpoint for admin.html)
app.post('/api/home-background', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded or file type not allowed.' });
        }
        const relativePath = path.join('assets', 'uploads', req.file.filename).replace(/\\/g, '/');

        const data = await readData();
        data.homeBackgroundImage = relativePath; // Update homeBackgroundImage path
        await writeData(data);

        res.json({
            success: true,
            message: 'Home background image uploaded successfully',
            filePath: relativePath
        });
    } catch (err) {
        console.error('Error uploading home background image:', err);
        res.status(500).json({ success: false, error: 'Failed to upload home background image' });
    }
});

// --- Metrics Endpoint ---
// PUT /api/metrics/:index - Update metrics (assuming single metrics object at index 0)
app.put('/api/metrics/:index', async (req, res) => {
    const index = parseInt(req.params.index, 10);
    if (index !== 0) {
        return res.status(400).json({ success: false, error: 'Invalid metrics index. Only index 0 is supported.' });
    }
    try {
        const data = await readData();
        if (!data.metrics) data.metrics = {};

        // Parse numeric values explicitly
        const { hIndex, totalCitations, i10Index } = req.body;
        if (hIndex !== undefined) data.metrics.hIndex = Number(hIndex) || 0;
        if (totalCitations !== undefined) data.metrics.totalCitations = Number(totalCitations) || 0;
        if (i10Index !== undefined) data.metrics.i10Index = Number(i10Index) || 0;

        await writeData(data);
        res.json({ success: true, message: 'Metrics updated successfully' });
    } catch (err) {
        console.error('Error updating metrics:', err);
        res.status(500).json({ success: false, error: 'Failed to update metrics' });
    }
});

// --- Generic CRUD Endpoints for Arrays ---
// GET /api/:section - Get all items in a section
app.get('/api/:section', async (req, res) => {
    const section = req.params.section;
    // Map admin.html endpoint names to data.json keys if they differ
    const sectionMap = {
        'collaborators-mentors': 'collaboratorsMentors',
        'research-areas': 'researchAreas',
        'social-links': 'socialLinks'
    };
    const dataKey = sectionMap[section] || section;

    const allowedSections = [
        'education', 'experience', 'publications', 'gallery', 'posts',
        'resources', 'collaboratorsMentors', 'researchAreas', 'socialLinks'
    ];
    if (!allowedSections.includes(dataKey)) {
        return res.status(400).json({ success: false, error: 'Invalid section' });
    }
    try {
        const data = await readData();
        res.json({ success: true, data: data[dataKey] || [] });
    } catch (err) {
        console.error(`Error reading section ${dataKey}:`, err);
        res.status(500).json({ success: false, error: `Failed to load ${dataKey}` });
    }
});

// POST /api/:section - Add an item to a section
// Handles file uploads for sections that might need them (gallery, posts, resources, collaborators-mentors)
app.post('/api/:section', upload.single('file'), async (req, res) => {
    let section = req.params.section;
    // Map admin.html endpoint names to data.json keys
    const sectionMap = {
        'collaborators-mentors': 'collaboratorsMentors',
        'research-areas': 'researchAreas',
        'social-links': 'socialLinks'
    };
    const dataKey = sectionMap[section] || section;

    const allowedSections = [
        'education', 'experience', 'publications', 'gallery', 'posts',
        'resources', 'collaboratorsMentors', 'researchAreas', 'socialLinks'
    ];
    if (!allowedSections.includes(dataKey)) {
        return res.status(400).json({ success: false, error: 'Invalid section' });
    }
    try {
        const data = await readData();
        if (!Array.isArray(data[dataKey])) {
            data[dataKey] = [];
        }

        let newItem = req.body;

        // Handle file upload for specific sections
        if ((dataKey === 'gallery' || dataKey === 'posts' || dataKey === 'resources' || dataKey === 'collaboratorsMentors') && req.file) {
            const relativePath = path.join('assets', 'uploads', req.file.filename).replace(/\\/g, '/');
            // Map the uploaded file path to the expected field name in the data structure
            if (dataKey === 'gallery' || dataKey === 'posts') {
                newItem.image = relativePath; // For gallery and posts, image field
            } else if (dataKey === 'resources') {
                newItem.file = relativePath; // For resources, file field
                newItem.mimeType = req.file.mimetype; // Store MIME type
            } else if (dataKey === 'collaboratorsMentors') {
                 newItem.image = relativePath; // For collaborators, image field
            }
        }

        data[dataKey].push(newItem);
        await writeData(data);
        res.status(201).json({ success: true, message: `${dataKey.slice(0, -1)} added successfully`, data: newItem });
    } catch (err) {
        console.error(`Error adding to section ${dataKey}:`, err);
        res.status(500).json({ success: false, error: `Failed to add ${dataKey.slice(0, -1)}` });
    }
});

// PUT /api/:section/:index - Update an item in a section
// Handles file uploads for updates as well
app.put('/api/:section/:index', upload.single('file'), async (req, res) => {
    let section = req.params.section;
    const index = parseInt(req.params.index, 10);
    // Map admin.html endpoint names to data.json keys
    const sectionMap = {
        'collaborators-mentors': 'collaboratorsMentors',
        'research-areas': 'researchAreas',
        'social-links': 'socialLinks'
    };
    const dataKey = sectionMap[section] || section;

    const allowedSections = [
        'education', 'experience', 'publications', 'gallery', 'posts',
        'resources', 'collaboratorsMentors', 'researchAreas', 'socialLinks'
    ];
    if (!allowedSections.includes(dataKey) || isNaN(index)) {
        return res.status(400).json({ success: false, error: 'Invalid section or index' });
    }
    try {
        const data = await readData();
        if (!Array.isArray(data[dataKey]) || index < 0 || index >= data[dataKey].length) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        let updatedItem = { ...data[dataKey][index], ...req.body }; // Merge existing and new data

        // Handle file upload for specific sections during update
        if ((dataKey === 'gallery' || dataKey === 'posts' || dataKey === 'resources' || dataKey === 'collaboratorsMentors') && req.file) {
            const relativePath = path.join('assets', 'uploads', req.file.filename).replace(/\\/g, '/');
            if (dataKey === 'gallery' || dataKey === 'posts') {
                updatedItem.image = relativePath;
            } else if (dataKey === 'resources') {
                updatedItem.file = relativePath;
                updatedItem.mimeType = req.file.mimetype;
            } else if (dataKey === 'collaboratorsMentors') {
                 updatedItem.image = relativePath;
            }
        }

        data[dataKey][index] = updatedItem;
        await writeData(data);
        res.json({ success: true, message: `${dataKey.slice(0, -1)} updated successfully`, data: updatedItem });
    } catch (err) {
        console.error(`Error updating ${dataKey} item ${index}:`, err);
        res.status(500).json({ success: false, error: `Failed to update ${dataKey.slice(0, -1)}` });
    }
});

// DELETE /api/:section/:index - Delete an item from a section
app.delete('/api/:section/:index', async (req, res) => {
    let section = req.params.section;
    const index = parseInt(req.params.index, 10);
    // Map admin.html endpoint names to data.json keys
    const sectionMap = {
        'collaborators-mentors': 'collaboratorsMentors',
        'research-areas': 'researchAreas',
        'social-links': 'socialLinks'
    };
    const dataKey = sectionMap[section] || section;

    const allowedSections = [
        'education', 'experience', 'publications', 'gallery', 'posts',
        'resources', 'collaboratorsMentors', 'researchAreas', 'socialLinks'
    ];
    if (!allowedSections.includes(dataKey) || isNaN(index)) {
        return res.status(400).json({ success: false, error: 'Invalid section or index' });
    }
    try {
        const data = await readData();
        if (!Array.isArray(data[dataKey]) || index < 0 || index >= data[dataKey].length) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        // Optional: Add logic to delete the associated file from the filesystem
        // Requires careful path validation to prevent directory traversal.
        data[dataKey].splice(index, 1);
        await writeData(data);
        res.json({ success: true, message: `${dataKey.slice(0, -1)} deleted successfully` });
    } catch (err) {
        console.error(`Error deleting ${dataKey} item ${index}:`, err);
        res.status(500).json({ success: false, error: `Failed to delete ${dataKey.slice(0, -1)}` });
    }
});

// POST /api/contact - Handle contact form submission (from index.html)
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    // --- Configure Nodemailer ---
    // IMPORTANT: Replace with your actual email service credentials
    // Consider using environment variables for security (dotenv package)
    const transporter = nodemailer.createTransporter({
        // service: 'gmail',
        host: 'smtp.ethereal.email', // Example using Ethereal for testing
        port: 587,
        secure: false,
        auth: {
            user: 'your_test_email@ethereal.email',
            pass: 'your_test_password'
        }
    });

    const mailOptions = {
        from: email,
        to: 'your_admin_email@example.com',
        subject: `Contact Form: ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    };

    try {
        // const info = await transporter.sendMail(mailOptions);
        // console.log('Message sent: %s', info.messageId);
        // --- For Testing with Ethereal ---
        // const info = await transporter.sendMail(mailOptions);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        // --- End Testing ---

        console.log('Contact Form Submitted (Simulated):', { name, email, subject, message });
        res.status(200).json({ success: true, message: 'Message sent successfully (simulated)' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

// --- Serve the main page and admin page ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});