import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const uploadImage = async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file provided');
    }

    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'luckyfoods/menu',
        transformation: [
            { width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        ],
    });

    res.json({ url: result.secure_url, publicId: result.public_id });
};

export { uploadImage, upload };
