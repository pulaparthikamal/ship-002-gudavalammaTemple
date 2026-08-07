/**
 * @swagger
 * tags:
 *   name: Activities
 *   description: System activity and audit logs
 */

/**
 * @swagger
 * /activities:
 *   get:
 *     summary: Get all system activities (Admin only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: JSON string for filtering and pagination
 *     responses:
 *       200:
 *         description: List of activities
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /activities/me:
 *   get:
 *     summary: Get my activities
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's activities
 *       401:
 *         description: Unauthorized
 */
