import express from 'express';
import appsRouter from './apps.js';
import consoleRouter from './console.js';

const router = express.Router();

router.use('/apps', appsRouter);
router.use('/console', consoleRouter);

export default router;
