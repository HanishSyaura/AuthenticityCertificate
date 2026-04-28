const { z } = require('zod');
const usersService = require('./users.service');

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['super_admin', 'admin', 'operator']).optional()
});

const roleSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'operator'])
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
    const user = await usersService.createUser({
      name: data.name,
      email: data.email,
      password: data.password,
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
    const user = await usersService.softDeleteUser({ id });
    res.success(user, 'User deleted');
  } catch (e) {
    res.error(e.message, 400);
  }
}

module.exports = {
  list,
  create,
  updateRole,
  remove
};

