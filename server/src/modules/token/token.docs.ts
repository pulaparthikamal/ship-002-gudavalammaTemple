/**
 * @swagger
 * tags:
 *   name: Tokens
 *   description: Token management
 */

/**
 * @swagger
 * /tokens:
 *   get:
 *     summary: List all active and revoked tokens
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tokens
 */
