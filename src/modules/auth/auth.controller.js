const authService = require('./auth.service');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function getZodErrorMessage(error) {
  const firstIssue = Array.isArray(error?.issues) ? error.issues[0] : Array.isArray(error?.errors) ? error.errors[0] : null;
  return firstIssue?.message || 'Invalid request';
}

async function login(req, res, next) {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData.email, validatedData.password);
    res.success(result, 'Login successful');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.error(getZodErrorMessage(error), 400);
    }
    if (error?.message === 'db_timeout') {
      return res.error('Database temporarily unavailable', 503);
    }
    if (error?.message === 'db_unavailable') {
      return res.error('Database temporarily unavailable', 503);
    }
    if (error?.message === 'jwt_secret_missing') {
      return res.error('Service temporarily unavailable', 503);
    }
    if (typeof error?.name === 'string' && error.name.startsWith('Prisma')) {
      return res.error('Database temporarily unavailable', 503);
    }
    if (error?.message === 'Invalid email or password') {
      return res.error('Invalid email or password', 401);
    }
    res.error('Unauthorized', 401);
  }
}

async function me(req, res) {
  try {
    if (!req.user?.id) return res.error('Unauthorized', 401);
    res.success({ user: req.user }, 'OK');
  } catch {
    res.error('Service temporarily unavailable', 503);
  }
}

const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().optional(),
    currentPassword: z.string().min(6).optional(),
    newPassword: z.string().min(8).max(200).optional()
  })
  .refine((v) => {
    if (!v.newPassword) return true;
    return Boolean(v.currentPassword);
  }, {
    message: 'Current password is required to set a new password'
  });

async function updateMe(req, res) {
  try {
    const validated = updateMeSchema.parse(req.body);
    const result = await authService.updateMe(req.user, validated);
    res.success(result, 'OK');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.error(getZodErrorMessage(error), 400);
    }
    if (error?.message === 'Forbidden') {
      return res.error('Insufficient permissions', 403);
    }
    if (error?.message === 'Invalid current password') {
      return res.error('Invalid current password', 400);
    }
    if (error?.message === 'Email already in use') {
      return res.error('Email already in use', 400);
    }
    if (error?.message === 'Unauthorized') {
      return res.error('Unauthorized', 401);
    }
    if (error?.message === 'db_timeout') {
      return res.error('Database temporarily unavailable', 503);
    }
    if (typeof error?.name === 'string' && error.name.startsWith('Prisma')) {
      return res.error('Database temporarily unavailable', 503);
    }
    res.error('Service temporarily unavailable', 503);
  }
}

module.exports = {
  login,
  me,
  updateMe
};
