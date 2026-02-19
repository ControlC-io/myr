import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

const COUNTER_KEY = 'counter';

async function getCount(): Promise<number> {
  const row = await prisma.systemSettings.findUnique({
    where: { settingKey: COUNTER_KEY },
  });
  if (!row || !row.providerConfig) return 0;
  const cfg = row.providerConfig as { count?: number };
  return typeof cfg.count === 'number' ? cfg.count : 0;
}

/**
 * @swagger
 * /api/counter:
 *   get:
 *     summary: Get current counter value
 *     description: Returns the current persisted counter value. Requires a valid JWT token.
 *     tags:
 *       - Counter
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current counter value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Missing or invalid JWT token
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await getCount();
    res.json({ count });
  } catch (error) {
    console.error('Error reading counter:', error);
    res.status(500).json({ error: 'Failed to read counter' });
  }
});

/**
 * @swagger
 * /api/counter/increment:
 *   post:
 *     summary: Increment the counter
 *     description: Increments the persisted counter by 1. Requires a valid JWT token, proving centralized middleware authentication.
 *     tags:
 *       - Counter
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated counter value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 6
 *                 changedBy:
 *                   type: string
 *                   description: Email of the authenticated user who modified the counter
 *       401:
 *         description: Missing or invalid JWT token
 */
router.post('/increment', async (req: Request, res: Response): Promise<void> => {
  try {
    const current = await getCount();
    const newCount = current + 1;

    await prisma.systemSettings.upsert({
      where: { settingKey: COUNTER_KEY },
      update: { providerConfig: { count: newCount } },
      create: {
        settingKey: COUNTER_KEY,
        isEnabled: true,
        providerConfig: { count: newCount },
      },
    });

    res.json({ count: newCount, changedBy: req.user?.email ?? 'unknown' });
  } catch (error) {
    console.error('Error incrementing counter:', error);
    res.status(500).json({ error: 'Failed to increment counter' });
  }
});

/**
 * @swagger
 * /api/counter/decrement:
 *   post:
 *     summary: Decrement the counter
 *     description: Decrements the persisted counter by 1. Requires a valid JWT token, proving centralized middleware authentication.
 *     tags:
 *       - Counter
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated counter value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 4
 *                 changedBy:
 *                   type: string
 *                   description: Email of the authenticated user who modified the counter
 *       401:
 *         description: Missing or invalid JWT token
 */
router.post('/decrement', async (req: Request, res: Response): Promise<void> => {
  try {
    const current = await getCount();
    const newCount = current - 1;

    await prisma.systemSettings.upsert({
      where: { settingKey: COUNTER_KEY },
      update: { providerConfig: { count: newCount } },
      create: {
        settingKey: COUNTER_KEY,
        isEnabled: true,
        providerConfig: { count: newCount },
      },
    });

    res.json({ count: newCount, changedBy: req.user?.email ?? 'unknown' });
  } catch (error) {
    console.error('Error decrementing counter:', error);
    res.status(500).json({ error: 'Failed to decrement counter' });
  }
});

export default router;
