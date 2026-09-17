import express from 'express';
import { healthCheck, verifyRoom } from '../controllers/roomController.js';

const router = express.Router();

router.get('/health', healthCheck);
router.get('/rooms/:roomCode', verifyRoom);

export default router;
