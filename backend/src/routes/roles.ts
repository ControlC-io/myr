import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/roles:
 *   get:
 *     summary: List all roles with their endpoint mappings
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Role'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/roles', async (_req: Request, res: Response): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      include: { endpointMappings: true },
      orderBy: { name: 'asc' },
    });
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * @swagger
 * /api/admin/roles:
 *   post:
 *     summary: Create a new role
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Manager
 *               description:
 *                 type: string
 *                 example: Can manage resources but not system settings
 *     responses:
 *       201:
 *         description: Role created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Role'
 *       400:
 *         description: name is required
 *       409:
 *         description: Role name already exists
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/roles', async (req: Request, res: Response): Promise<void> => {
  const { name, description } = req.body as { name?: string; description?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  try {
    const role = await prisma.role.create({
      data: { name: name.trim(), description: description?.trim() },
      include: { endpointMappings: true },
    });
    res.status(201).json(role);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: `Role "${name}" already exists` });
      return;
    }
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

/**
 * @swagger
 * /api/admin/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Role deleted
 *       404:
 *         description: Role not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/roles/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.role.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// ─── Endpoint Mappings ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/roles/{id}/endpoints:
 *   get:
 *     summary: List endpoint mappings for a role
 *     tags:
 *       - RBAC
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
 *         description: Array of endpoint mappings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RoleEndpointMapping'
 *       404:
 *         description: Role not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/roles/:id/endpoints', async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: { endpointMappings: true },
    });
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    res.json(role.endpointMappings);
  } catch (error) {
    console.error('Error fetching endpoint mappings:', error);
    res.status(500).json({ error: 'Failed to fetch endpoint mappings' });
  }
});

/**
 * @swagger
 * /api/admin/roles/{id}/endpoints:
 *   post:
 *     summary: Add an endpoint mapping to a role
 *     tags:
 *       - RBAC
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
 *             required:
 *               - endpoint
 *               - method
 *             properties:
 *               endpoint:
 *                 type: string
 *                 example: /api/admin/settings
 *               method:
 *                 type: string
 *                 enum: [GET, POST, PATCH, PUT, DELETE, "*"]
 *                 example: GET
 *     responses:
 *       201:
 *         description: Mapping created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleEndpointMapping'
 *       400:
 *         description: endpoint and method are required
 *       404:
 *         description: Role not found
 *       409:
 *         description: Mapping already exists
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/roles/:id/endpoints', async (req: Request, res: Response): Promise<void> => {
  const { endpoint, method } = req.body as { endpoint?: string; method?: string };

  if (!endpoint?.trim() || !method?.trim()) {
    res.status(400).json({ error: 'endpoint and method are required' });
    return;
  }

  const VALID_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', '*'];
  const normalizedMethod = method.trim().toUpperCase();
  if (!VALID_METHODS.includes(normalizedMethod)) {
    res.status(400).json({ error: `method must be one of: ${VALID_METHODS.join(', ')}` });
    return;
  }

  try {
    const role = await prisma.role.findUnique({ where: { id: req.params.id } });
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    const mapping = await prisma.roleEndpointMapping.create({
      data: {
        roleId: req.params.id,
        endpoint: endpoint.trim(),
        method: normalizedMethod,
      },
    });
    res.status(201).json(mapping);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'Mapping already exists for this role/endpoint/method combination' });
      return;
    }
    console.error('Error creating endpoint mapping:', error);
    res.status(500).json({ error: 'Failed to create endpoint mapping' });
  }
});

/**
 * @swagger
 * /api/admin/roles/{id}/endpoints/{mappingId}:
 *   delete:
 *     summary: Remove an endpoint mapping from a role
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: mappingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Mapping deleted
 *       404:
 *         description: Mapping not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/roles/:id/endpoints/:mappingId', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.roleEndpointMapping.delete({ where: { id: req.params.mappingId } });
    res.status(204).send();
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ error: 'Endpoint mapping not found' });
      return;
    }
    console.error('Error deleting endpoint mapping:', error);
    res.status(500).json({ error: 'Failed to delete endpoint mapping' });
  }
});

// ─── Users + Role Assignment ──────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users with their assigned roles
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserWithRoles'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        userRoles: {
          include: { role: { select: { id: true, name: true, description: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = users.map((u) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role),
      userRoles: undefined,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/roles:
 *   post:
 *     summary: Assign a role to a user
 *     tags:
 *       - RBAC
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
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role assigned
 *       400:
 *         description: roleId is required
 *       404:
 *         description: User or role not found
 *       409:
 *         description: User already has this role
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/users/:id/roles', async (req: Request, res: Response): Promise<void> => {
  const { roleId } = req.body as { roleId?: string };

  if (!roleId?.trim()) {
    res.status(400).json({ error: 'roleId is required' });
    return;
  }

  try {
    const [user, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.params.id } }),
      prisma.role.findUnique({ where: { id: roleId } }),
    ]);

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (!role)  { res.status(404).json({ error: 'Role not found' }); return; }

    const userRole = await prisma.userRole.create({
      data: { userId: req.params.id, roleId },
      include: { role: { select: { id: true, name: true } } },
    });

    res.status(201).json(userRole);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'User already has this role' });
      return;
    }
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/roles/{roleId}:
 *   delete:
 *     summary: Remove a role from a user
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Role removed
 *       404:
 *         description: Assignment not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/users/:id/roles/:roleId', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.userRole.deleteMany({
      where: { userId: req.params.id, roleId: req.params.roleId },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error removing role from user:', error);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

export default router;
