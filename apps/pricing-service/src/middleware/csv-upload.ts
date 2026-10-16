import multer from 'multer';
import { config } from '../config';

export const uploadPricingCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      callback(new Error('Only .csv files are allowed'));
      return;
    }
    callback(null, true);
  },
}).single('file');
