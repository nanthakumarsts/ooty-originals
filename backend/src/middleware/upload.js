const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config/env');
const { HttpError } = require('./error');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(415, 'Only JPG, PNG, WebP or AVIF images are allowed'));
  },
});

/**
 * Re-encode an uploaded image to WebP (max 1600px) and store it under /uploads/<folder>.
 * Re-encoding also strips metadata and guarantees the file really is an image.
 */
async function saveImage(file, folder = 'products') {
  const dir = path.join(config.uploadsDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.webp`;
  try {
    await sharp(file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(path.join(dir, name));
  } catch {
    throw new HttpError(415, 'That file could not be read as an image');
  }
  return `/uploads/${folder}/${name}`;
}

const RETURN_ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/3gpp'
];

const returnUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 4 }, // up to 50MB for return proof videos/images
  fileFilter: (req, file, cb) => {
    if (RETURN_ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(415, 'Only JPG, PNG, WebP images or MP4, WebM, MOV videos are allowed as proof'));
  },
});

/**
 * Saves a return proof attachment (image or video)
 */
async function saveReturnAttachment(file) {
  const dir = path.join(config.uploadsDir, 'returns');
  fs.mkdirSync(dir, { recursive: true });
  const isVideo = file.mimetype.startsWith('video/');

  if (isVideo) {
    const ext = file.mimetype.includes('mp4') ? '.mp4' : file.mimetype.includes('webm') ? '.webm' : path.extname(file.originalname) || '.mp4';
    const filename = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(dir, filename), file.buffer);
    return {
      url: `/uploads/returns/${filename}`,
      type: 'video',
      name: file.originalname,
      size: file.size,
    };
  } else {
    const name = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.webp`;
    try {
      await sharp(file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toFile(path.join(dir, name));
    } catch {
      // Fallback in case sharp cannot process the specific raw image format
      const ext = path.extname(file.originalname) || '.jpg';
      const fallbackName = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(dir, fallbackName), file.buffer);
      return {
        url: `/uploads/returns/${fallbackName}`,
        type: 'image',
        name: file.originalname,
        size: file.size,
      };
    }
    return {
      url: `/uploads/returns/${name}`,
      type: 'image',
      name: file.originalname,
      size: file.size,
    };
  }
}

module.exports = { upload, returnUpload, saveImage, saveReturnAttachment };
