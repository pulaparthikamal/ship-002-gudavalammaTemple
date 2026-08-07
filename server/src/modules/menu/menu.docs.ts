/**
 * @swagger
 * tags:
 *   name: Menus
 *   description: Dynamic Navigation Menu management
 */

/**
 * @swagger
 * /menus:
 *   get:
 *     summary: Get menu tree
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Menu tree structure
 */

/**
 * @swagger
 * /menus/my-menu:
 *   get:
 *     summary: Get menus for current user role
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personalized menu list
 */

/**
 * @swagger
 * /menus/flat:
 *   get:
 *     summary: List all menus in flat format
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Flat list of menus
 */

/**
 * @swagger
 * /menus/{id}:
 *   get:
 *     summary: Get menu by ID
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Menu details
 */

/**
 * @swagger
 * /menus:
 *   post:
 *     summary: Create new menu item
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, route, sequenceNo]
 *             properties:
 *               title: { type: string }
 *               route: { type: string }
 *               sequenceNo: { type: number }
 *               iconName: { type: string }
 *               roleId: { type: string }
 *               submenu: { type: array, items: { type: object } }
 *     responses:
 *       201:
 *         description: Menu created
 */

/**
 * @swagger
 * /menus/{id}:
 *   put:
 *     summary: Update menu item
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Menu updated
 */

/**
 * @swagger
 * /menus/{id}:
 *   delete:
 *     summary: Soft delete menu item
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Menu deleted
 */

/**
 * @swagger
 * /menus/bulk-delete:
 *   post:
 *     summary: Bulk soft delete menus
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Menus deleted
 */

/**
 * @swagger
 * /menus/bulk-update:
 *   patch:
 *     summary: Bulk update menus
 *     tags: [Menus]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, data]
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *               data: { type: object }
 *     responses:
 *       200:
 *         description: Menus updated
 */
