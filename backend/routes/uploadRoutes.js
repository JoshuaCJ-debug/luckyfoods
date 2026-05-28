import express from 'express';
import { uploadImage, upload } from '../controllers/uploadController.js';
import { protect, managerCheck } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, managerCheck, upload.single('image'), uploadImage);

export default router;
