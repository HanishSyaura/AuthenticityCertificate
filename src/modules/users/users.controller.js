const { z } = require('zod');
const usersService = require('./users.service');

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD && String(process.env.DEFAULT_PASSWORD).trim() ? String(process.env.DEFAULT_PASSWORD).trim() : 'Password123!';

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(['super_admin', 'admin', 'operator']).optional()
});

const roleSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'operator'])
});

const resetPasswordSchema = z.object({
  password: z.string().min(8).optional()
});

async function list(req, res) {
  try {
    const users = await usersService.listUsers();
    res.success(users);
  } catch (e) {
    res.error(e.message);
  }
}

async function create(req, res) {
  try {
    const data = createSchema.parse(req.body);
    const password = typeof data.password === 'string' && data.password.trim() ? data.password : DEFAULT_PASSWORD;
    if (String(password).length < 8) return res.error('Password must be at least 8 characters', 400);
    const user = await usersService.createUser({
      name: data.name,
      email: data.email,
      password,
      role: data.role || 'admin'
    });
    res.success(user, 'User created');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const data = roleSchema.parse(req.body);
    const user = await usersService.updateUserRole({ id, role: data.role });
    res.success(user, 'Role updated');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const result = await usersService.deleteUser({ id });
    res.success(result, 'User deleted');
  } catch (e) {
    res.error(e.message, 400);
  }
}

async function resetPassword(req, res) {
  try {
    const { id } = req.params;
    const data = resetPasswordSchema.parse(req.body);
    const password = typeof data.password === 'string' && data.password.trim() ? data.password : DEFAULT_PASSWORD;
    if (String(password).length < 8) return res.error('Password must be at least 8 characters', 400);
    await usersService.setUserPassword({ id, password });
    res.success({ id: Number(id) }, 'Password updated');
  } catch (e) {
    if (e instanceof z.ZodError) return res.error(e.errors[0].message, 400);
    res.error(e.message, 400);
  }
}

module.exports = {
  list,
  create,
  updateRole,
  remove,
  resetPassword
};
